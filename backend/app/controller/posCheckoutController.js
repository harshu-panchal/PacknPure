import mongoose from "mongoose";
import Order from "../models/order.js";
import PosIdempotency from "../models/posIdempotency.js";
import { generateReceiptNumber, generateInvoiceNumber } from "../services/posSequenceService.js";
import { recordCashMovement } from "../services/posSessionService.js";
import { logPosAction } from "../services/posAuditService.js";
import { handleResponse } from "../utils/helper.js";
import { planHubFulfillment, reserveHubInventory, createAutoPurchaseRequests } from "../services/hubOrderOrchestrator.js";
import crypto from "crypto";

import Razorpay from "razorpay";
import dotenv from "dotenv";
import PosSession from "../models/posSession.js";
import Product from "../models/product.js";

dotenv.config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const hashPayload = (payload) => {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
};

export const createPosPaymentOrder = async (req, res) => {
    try {
        const { amount, currency = "INR" } = req.body;
        if (!amount) {
            return handleResponse(res, 400, "Amount is required");
        }

        const options = {
            amount: Math.round(amount * 100),
            currency,
            receipt: `pos_receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        return handleResponse(res, 200, "POS Razorpay order created", order);
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        return handleResponse(res, 500, error.message);
    }
};

export const processPosCheckout = async (req, res) => {
  const idempotencyKey = req.headers["x-idempotency-key"];
  const cashierId = req.user.id;
  
  if (!idempotencyKey) {
    return handleResponse(res, 400, "Idempotency key is required for POS checkout.");
  }

  const payloadHash = hashPayload(req.body);

  // 1. Idempotency Check
  const existingRequest = await PosIdempotency.findOne({ idempotencyKey, cashierId });
  if (existingRequest) {
    if (existingRequest.requestBodyHash !== payloadHash) {
      return handleResponse(res, 400, "Idempotency key reused with different payload.");
    }
    if (existingRequest.responseStatus) {
      // Return previous response
      return res.status(existingRequest.responseStatus).json(existingRequest.responseBody);
    }
    return handleResponse(res, 409, "Request is already being processed.");
  }

  // Register the new idempotency key
  await PosIdempotency.create({
    idempotencyKey,
    cashierId,
    requestPath: req.originalUrl,
    requestBodyHash: payloadHash,
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      items, 
      payment, 
      guestCustomer, 
      posDetails,
      discountDetails,
      fulfillmentDetails,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    } = req.body;

    const { posTerminalId, posSessionId } = posDetails || {};

    // Validate Session
    const activeSession = await PosSession.findOne({ _id: posSessionId, cashier: cashierId, status: "open" }).session(session);
    if (!activeSession) {
      throw new Error("Invalid or closed POS Session.");
    }

    // Verify Razorpay if online payment
    if (payment.method === "upi" || payment.method === "card") {
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        throw new Error("Razorpay payment details are missing.");
      }
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
          .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
          .update(body.toString())
          .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        throw new Error("Payment verification failed (Invalid signature).");
      }
    }

    // Recalculate Pricing natively
    let subtotal = 0;
    let totalGst = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product || item.productId).session(session).lean();
      if (!product) throw new Error(`Product ${item.product || item.productId} not found`);
      
      let price = product.basePrice || product.price || 0;
      let variant = null;
      let gstRate = product.gstRate || 0;
      let gstEnabled = product.gstEnabled || false;

      if (item.variantId && product.variants) {
        variant = product.variants.find(v => String(v._id) === String(item.variantId) || String(v.id) === String(item.variantId));
        if (variant) {
          price = variant.price || price;
          if (variant.gstEnabled !== undefined) gstEnabled = variant.gstEnabled;
          if (gstEnabled) gstRate = variant.gstRate || gstRate;
        }
      }

      const itemTotal = price * (item.quantity || 1);
      subtotal += itemTotal;

      if (gstEnabled && gstRate > 0) {
        const base = itemTotal / (1 + (gstRate / 100));
        totalGst += (itemTotal - base);
      }

      validatedItems.push({
        ...item,
        price,
        gstRate,
        gstEnabled
      });
    }

    const discountAmount = Number(discountDetails?.amount || 0);
    const total = Math.max(0, subtotal - discountAmount);

    const pricing = {
      subtotal: Number(subtotal.toFixed(2)),
      gst: Number(totalGst.toFixed(2)),
      discount: Number(discountAmount.toFixed(2)),
      discountDetails,
      total: Number(total.toFixed(2))
    };

    // 2. Generate Identifiers
    const receiptNumber = await generateReceiptNumber(session);
    const invoiceNumber = await generateInvoiceNumber(session);
    const orderId = `POS${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // 3. Create Order Payload
    const newOrder = new Order({
      orderId,
      receiptNumber,
      invoiceNumber,
      orderSource: "POS",
      guestCustomer,
      address: fulfillmentDetails?.address || undefined,
      posDetails: {
        posTerminalId,
        posSessionId,
        cashierId
      },
      items: validatedItems,
      payment: {
        method: payment.method || "cash",
        status: "completed",
        paidAmount: payment.paidAmount || pricing.total,
        remainingAmount: 0,
        changeReturned: payment.changeReturned || 0,
        splitPayments: payment.splitPayments || []
      },
      pricing: {
        subtotal: pricing.subtotal,
        gst: pricing.gst,
        discount: pricing.discount || 0,
        discountDetails,
        total: pricing.total
      },
      // If Home Delivery, route through standard workflow starting at pending. If Take Away, instantly complete.
      status: fulfillmentDetails?.type === "HOME_DELIVERY" ? "pending" : "delivered",
      workflowStatus: fulfillmentDetails?.type === "HOME_DELIVERY" ? "PENDING" : "DELIVERED",
    });

    await newOrder.save({ session });

    // 4. Reserve & Commit Inventory (Reusing exact logic)
    const hubPlan = await planHubFulfillment(newOrder.items);
    
    // Enrich order items with allocation data just like online checkout
    const itemAllocations = new Map();
    for (const alloc of hubPlan.allocations) {
       itemAllocations.set(alloc.productId + (alloc.variantId || ""), alloc.reserveQty);
    }
    const itemShortages = new Map();
    for (const short of hubPlan.shortages) {
       itemShortages.set(short.productId + (short.variantId || ""), short.shortageQty);
    }

    newOrder.items = newOrder.items.map(item => {
       const key = String(item.product) + (item.variantId ? String(item.variantId) : "");
       return {
         ...item.toObject(),
         hubReservedQty: itemAllocations.get(key) || 0,
         vendorProcuredQty: itemShortages.get(key) || 0
       };
    });

    const reserveResult = await reserveHubInventory(hubPlan.allocations, hubPlan.hubId, session);
    
    if (!reserveResult.ok) {
      throw new Error("Stock unavailable: inventory was updated by another request. Please try again.");
    }

    // Set procurement flags and trigger backend procurement engine
    if (hubPlan.shortages.length > 0) {
      await createAutoPurchaseRequests({
        order: newOrder,
        shortages: hubPlan.shortages,
        hubId: hubPlan.hubId,
      }, session);
      newOrder.hubStatus = "procurement_required";
      newOrder.procurementRequired = true;
    } else {
      newOrder.hubStatus = "inventory_reserved";
      newOrder.procurementRequired = false;
    }

    // Step through lifecycle rapidly ONLY if it's TAKE_AWAY
    if (fulfillmentDetails?.type !== "HOME_DELIVERY") {
      newOrder.status = "delivered";
      newOrder.workflowStatus = "DELIVERED";
      newOrder.acceptedAt = new Date();
      newOrder.deliveredAt = new Date();
    }
    
    await newOrder.save({ session });
    
    // Since we are instantly completing a POS order (Take Away), deduct the reserved stock permanently.
    if (fulfillmentDetails?.type !== "HOME_DELIVERY") {
      const { deductHubInventory } = await import("../services/inventoryLifecycleService.js");
      for (const alloc of hubPlan.allocations) {
         await deductHubInventory(alloc.productId, alloc.variantId, alloc.reserveQty, session);
      }
    }

    // 5. Log POS Cash Transaction if cash
    if (newOrder.payment.method === "cash" && posSessionId) {
      await recordCashMovement(
        posSessionId,
        cashierId,
        "SALES",
        newOrder.pricing.total,
        `POS Sale - Receipt: ${receiptNumber}`,
        newOrder.orderId,
        session
      );
    }

    // Commit Transaction
    await session.commitTransaction();
    session.endSession();

    // 6. Async Post-Transaction Audit Logging (doesn't block response)
    logPosAction({
      action: "PRINT_RECEIPT",
      cashierId,
      sessionId: posSessionId,
      orderId: newOrder.orderId,
      details: { receiptNumber, total: pricing.total }
    }).catch(console.error);

    const responseBody = {
      success: true,
      message: "POS Checkout completed successfully",
      data: newOrder
    };

    // Update Idempotency record with success
    await PosIdempotency.updateOne(
      { idempotencyKey, cashierId },
      { $set: { responseStatus: 200, responseBody } }
    );

    return res.status(200).json(responseBody);

  } catch (error) {
    // Rollback everything
    await session.abortTransaction();
    session.endSession();
    
    const errorResponse = { success: false, message: error.message };

    // Update Idempotency record with failure so it can be retried if needed
    await PosIdempotency.deleteOne({ idempotencyKey, cashierId });

    return res.status(400).json(errorResponse);
  }
};
