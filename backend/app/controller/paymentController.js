import Razorpay from "razorpay";
import crypto from "crypto";
import handleResponse from "../utils/helper.js";
import Order from "../models/order.js";
import PaymentIntent from "../models/paymentIntent.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Initialize Razorpay (reuse keys from env)
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ===============================
   CREATE RAZORPAY ORDER
================================ */
export const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return handleResponse(res, 401, "Unauthorized");

        // Validate server-side pricing: do not trust frontend amounts.
        const { checkout } = req.body; // checkout contains cart snapshot, addressId, coupon, wallet, notes, deliverySlot
        if (!checkout) return handleResponse(res, 400, "Checkout data required");

        // TODO: Compute final amount server-side using existing pricing helpers.
        // For now, expect frontend to send a cartId or items; minimal validation.
        // IMPORTANT: This implementation must be extended to compute final amount deterministically.

        // Compute amount placeholder: front sends pricing.total; we'll validate presence
        const clientTotal = Number(checkout?.pricing?.total || 0);
        if (!clientTotal || clientTotal <= 0) return handleResponse(res, 400, "Invalid total amount");

        const amount = Math.round(clientTotal * 100); // paise

        // Create payment intent (server-side snapshot)
        const intent = await PaymentIntent.create({
            user: userId,
            amount: clientTotal,
            currency: checkout?.pricing?.currency || "INR",
            checkout,
            status: "created",
        });

        const options = {
            amount,
            currency: checkout?.pricing?.currency || "INR",
            receipt: `pi_${intent._id}`,
        };

        const order = await razorpay.orders.create(options);

        // Persist razorpay order id on intent
        intent.razorpayOrderId = order.id;
        await intent.save();

        console.info("[PAYMENT_INTENT] Created", { intentId: intent._id.toString(), razorpayOrderId: order.id });

        return handleResponse(res, 200, "Razorpay order created", {
            razorpayOrderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
            receipt: order.receipt,
            intentId: intent._id,
        });
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   VERIFY PAYMENT SIGNATURE
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

        // Verify HMAC
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

        // Load intent
        const intent = await PaymentIntent.findById(intentId).session(session);
        if (!intent) {
            await session.abortTransaction();
            session.endSession();
            return handleResponse(res, 404, "Payment intent not found");
        }

        // Idempotency: check if payment already processed
        if (intent.razorpayPaymentId && intent.razorpayPaymentId === razorpay_payment_id) {
            // Already processed — return existing order if present
            const existingOrder = await Order.findOne({ "payment.transactionId": razorpay_payment_id }).session(session);
            await session.commitTransaction();
            session.endSession();
            console.info("[PAYMENT_VERIFY] Duplicate verification", { intentId: intent._id.toString(), paymentId: razorpay_payment_id });
            return handleResponse(res, 200, "Payment already processed", { order: existingOrder || null });
        }

        // Mark intent processing
        intent.status = "processing";
        intent.razorpayPaymentId = razorpay_payment_id;
        intent.razorpaySignature = razorpay_signature;
        await intent.save({ session });

        // Now create actual order using existing createOrder service
        // Reuse the orderService.createOrder to avoid duplicating business logic. We will reconstruct order payload from intent.checkout
        const { checkout } = intent;

        // Recompute pricing server-side or accept intent.amount as canonical (TODO: tighten)
        const orderPayload = {
            address: checkout.address,
            payment: {
                method: "online",
                status: "completed",
                transactionId: razorpay_payment_id,
                paidAmount: intent.amount,
            },
            pricing: checkout.pricing,
            timeSlot: checkout.timeSlot,
            items: checkout.items,
            promotionId: checkout.promotionId || null,
        };

        // Import orderService.createOrder to create order with existing business logic
        const orderService = await import("../services/orderService.js");

        const createdOrder = await orderService.createOrder(orderPayload);

        // Persist transaction record using Transaction model if needed (reusing existing Transaction model)
        // TODO: Use Transaction model to record gateway payment

        intent.status = "completed";
        await intent.save({ session });

        await session.commitTransaction();
        session.endSession();

        console.info("[PAYMENT_SUCCESS] Order created from payment", { orderId: createdOrder.orderId, paymentId: razorpay_payment_id });

        return handleResponse(res, 200, "Payment verified and order created", { order: createdOrder });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Payment Verification Error:", error);
        return handleResponse(res, 500, error.message);
    }
};
