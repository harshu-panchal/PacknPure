import Razorpay from "razorpay";
import crypto from "crypto";
import handleResponse from "../utils/helper.js";
import Order from "../models/order.js";
import PaymentIntent from "../models/paymentIntent.js";
import User from "../models/customer.js";
import Transaction from "../models/transaction.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { calculateAndValidatePricing, validatePricingConsistency } from "../services/pricingCalculationService.js";
import { executeCoreOrderFulfillment } from "../services/coreOrderService.js";
dotenv.config();

// Initialize Razorpay (reuse keys from env)
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ===============================
   CREATE RAZORPAY ORDER (Server-Side Pricing)
================================ */
export const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return handleResponse(res, 401, "Unauthorized");

        const user = await User.findById(userId).select("walletBalance");
        if (!user) return handleResponse(res, 401, "User not found");

        const { checkout } = req.body;
        if (!checkout) return handleResponse(res, 400, "Checkout data required");

        // === CRITICAL: RECALCULATE PRICING SERVER-SIDE ===
        const { items, couponCode, walletToUse, deliveryCoords, address } = checkout;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return handleResponse(res, 400, "Cart items required");
        }

        if (!deliveryCoords || typeof deliveryCoords.lat !== "number" || typeof deliveryCoords.lng !== "number") {
            return handleResponse(res, 400, "Valid delivery coordinates required");
        }

        // SERVER-SIDE PRICING CALCULATION
        const { pricing, validatedItems, appliedCoupon } = await calculateAndValidatePricing({
            items,
            couponCode: couponCode || null,
            walletBalance: user.walletBalance || 0,
            walletToUse: walletToUse || 0,
            deliveryCoords,
            userId,
        });

        const amount = Math.round(pricing.total * 100); // paise

        // === CREATE PAYMENT INTENT with server-side snapshot ===
        const intent = await PaymentIntent.create({
            user: userId,
            amount: pricing.total,
            currency: "INR",
            razorpayOrderId: null, // Will be set after Razorpay order creation
            status: "created",
            
            // === CRITICAL: Store server-calculated pricing & cart snapshot ===
            pricingBreakdown: pricing,
            cartSnapshot: {
                items: validatedItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    variantId: item.variantId,
                    price: item.price,
                })),
            },
            coupon: appliedCoupon || null,
            address: {
                lat: deliveryCoords.lat,
                lng: deliveryCoords.lng,
                full: address?.full || null,
            },
            deliverySlot: checkout.deliverySlot || null,
            // Delivery Mode feature: snapshot so the order created after
            // payment verification carries the customer's selection
            deliveryMode: checkout.deliveryMode === "SLOT" ? "SLOT" : "EXPRESS",
            selectedSlot: checkout.selectedSlot || null,
            selectedDate: checkout.selectedDate || null,
            walletBalance: user.walletBalance,
            walletUsed: pricing.walletUsed,
            
            // Legacy field for backward compatibility
            checkout: {
                ...checkout,
                pricing, // Use server-calculated pricing
            },
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        });

        // Create Razorpay order with SERVER-CALCULATED amount
        const options = {
            amount,
            currency: "INR",
            receipt: `pi_${intent._id}`,
        };

        const order = await razorpay.orders.create(options);

        // Persist Razorpay order ID
        intent.razorpayOrderId = order.id;
        await intent.save();

        console.info("[PAYMENT_INTENT] Created with server-side pricing", {
            intentId: intent._id.toString(),
            razorpayOrderId: order.id,
            amount: pricing.total,
            coupon: couponCode || "none",
            walletUsed: pricing.walletUsed,
        });

        return handleResponse(res, 200, "Razorpay order created", {
            razorpayOrderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
            receipt: order.receipt,
            intentId: intent._id,
            pricingBreakdown: pricing, // Send back for frontend verification
        });
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        
        // Razorpay API errors might have error.error.description instead of error.message
        const errorMessage = error?.error?.description || error.message || "Failed to create payment order";
        
        return handleResponse(res, 500, errorMessage, { error: errorMessage });
    }
};


/* ===============================
   VERIFY PAYMENT SIGNATURE & CREATE ORDER
================================ */
export const verifyPayment = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            intentId,
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !intentId) {
            await session.abortTransaction();
            session.endSession();
            return handleResponse(res, 400, "Missing verification parameters");
        }

        // === 1. VERIFY RAZORPAY SIGNATURE ===
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        const isAuthentic = expectedSignature === razorpay_signature;

        if (!isAuthentic) {
            await session.abortTransaction();
            session.endSession();
            console.warn("[PAYMENT_VERIFY] Signature mismatch", { razorpay_order_id, razorpay_payment_id });
            return handleResponse(res, 400, "Payment verification failed", { signatureIsValid: false });
        }

        // === 2. LOAD PAYMENT INTENT ===
        const intent = await PaymentIntent.findById(intentId).session(session);
        if (!intent) {
            await session.abortTransaction();
            session.endSession();
            return handleResponse(res, 404, "Payment intent not found");
        }

        // === 3. IDEMPOTENCY CHECK: Prevent duplicate orders ===
        if (intent.razorpayPaymentId && intent.razorpayPaymentId === razorpay_payment_id) {
            // Already processed — return existing order
            const existingOrder = await Order.findOne({
                customer: intent.user,
                "payment.transactionId": razorpay_payment_id,
            }).session(session);
            
            await session.commitTransaction();
            session.endSession();
            
            console.info("[PAYMENT_VERIFY] Duplicate verification (idempotent)", {
                intentId: intent._id.toString(),
                paymentId: razorpay_payment_id,
            });
            return handleResponse(res, 200, "Payment already processed", { order: existingOrder || null });
        }

        // === 4. REVALIDATE PRICING (CRITICAL) ===
        // Recalculate pricing to ensure no tampering since intent creation
        const { checkout } = intent;
        if (!checkout || !checkout.items || checkout.items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            throw new Error("Invalid checkout data in payment intent");
        }

        try {
            const recalculated = await calculateAndValidatePricing({
                items: checkout.items,
                couponCode: intent.coupon?.code || null,
                walletBalance: intent.walletBalance || 0,
                walletToUse: intent.walletUsed || 0,
                deliveryCoords: { lat: intent.address?.lat, lng: intent.address?.lng },
                userId: intent.user.toString(),
            });

            // Validate pricing consistency
            await validatePricingConsistency(recalculated.pricing, intent.pricingBreakdown);
        } catch (pricingError) {
            await session.abortTransaction();
            session.endSession();
            console.error("[PAYMENT_VERIFY] Pricing validation failed", {
                error: pricingError.message,
                intentId,
            });
            return handleResponse(
                res,
                400,
                `Payment cannot be processed: ${pricingError.message}`
            );
        }

        // === 5. MARK INTENT AS PROCESSING ===
        intent.status = "processing";
        intent.razorpayPaymentId = razorpay_payment_id;
        intent.razorpaySignature = razorpay_signature;
        await intent.save({ session });

        // === 6. CALL UNIFIED FULFILLMENT SERVICE ===
        const customer = await User.findById(intent.user).session(session);
        if (!customer) {
            await session.abortTransaction();
            session.endSession();
            return handleResponse(res, 404, "Customer not found during verification");
        }

        const { orderForResponse, hubMeta } = await executeCoreOrderFulfillment({
            customerId: intent.user,
            customer,
            items: intent.cartSnapshot?.items || [],
            address: intent.address,
            payment: {
                method: "online",
                status: "completed",
                transactionId: razorpay_payment_id,
                gateway: "razorpay",
                paidAmount: intent.pricingBreakdown.total,
                walletUsed: intent.walletUsed
            },
            pricing: intent.pricingBreakdown,
            timeSlot: intent.deliverySlot,
            deliveryMode: intent.deliveryMode,
            selectedSlot: intent.selectedSlot,
            selectedDate: intent.selectedDate,
            promotionId: checkout.promotionId || null,
            session
        });

        // === 7. CREATE RAZORPAY TRANSACTION RECORD ===
        const transaction = new Transaction({
            user: intent.user,
            userModel: "User",
            order: orderForResponse._id,
            type: "Order Payment",
            amount: intent.pricingBreakdown.total,
            status: "Settled",
            reference: razorpay_payment_id,
            meta: {
                gateway: "razorpay",
                orderId: orderForResponse.orderId,
                paymentIntentId: intent._id.toString(),
            },
        });
        await transaction.save({ session });

        // === 8. MARK INTENT AS COMPLETED ===
        intent.status = "completed";
        await intent.save({ session });

        // === 9. COMMIT TRANSACTION ===
        await session.commitTransaction();
        session.endSession();

        console.info("[PAYMENT_SUCCESS] Order created from payment via unified service", {
            orderId: orderForResponse.orderId,
            paymentId: razorpay_payment_id,
            intentId: intent._id.toString(),
            amount: intent.pricingBreakdown.total,
        });

        return handleResponse(res, 200, "Payment verified and order created", {
            order: orderForResponse,
            hubMeta
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("[PAYMENT_VERIFY] Error", error);
        return handleResponse(res, 500, error.message);
    }
};
