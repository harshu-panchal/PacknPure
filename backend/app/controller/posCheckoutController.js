import mongoose from "mongoose";
import Order from "../models/order.js";
import PosIdempotency from "../models/posIdempotency.js";
import { generateReceiptNumber, generateInvoiceNumber } from "../services/posSequenceService.js";
import { recordCashMovement } from "../services/posSessionService.js";
import { logPosAction } from "../services/posAuditService.js";
import { handleResponse } from "../utils/helper.js";
import crypto from "crypto";

import Razorpay from "razorpay";
import dotenv from "dotenv";
import PosSession from "../models/posSession.js";
import Product from "../models/product.js";
import { getPosProviders } from "../services/posProviders/index.js";

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
  const providers = getPosProviders(req.user);
  
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
      fulfillmentDetails
    } = req.body;

    const razorpay_payment_id = req.body.razorpay_payment_id || payment?.razorpay_payment_id;
    const razorpay_order_id = req.body.razorpay_order_id || payment?.razorpay_order_id;
    const razorpay_signature = req.body.razorpay_signature || payment?.razorpay_signature;

    const { posTerminalId, posSessionId } = posDetails || {};

    // Validate Session
    const activeSession = await PosSession.findOne({ _id: posSessionId, cashierId: cashierId, status: "OPEN" }).session(session);
    if (!activeSession) {
      throw new Error("Invalid or closed POS Session.");
    }

    // Verify payment method based on role
    providers.payment.validatePayment(payment, process.env.RAZORPAY_KEY_SECRET);

    // Recalculate Pricing natively
    let subtotal = 0;
    let totalGst = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product || item.productId).session(session).lean();
      if (!product || product.status !== 'active') {
        throw new Error(`Product "${item.name || item.product || item.productId}" is no longer available.`);
      }
      
      let price = item.price !== undefined ? Number(item.price) : (product.salePrice || product.basePrice || product.price || product.purchasePrice || 0);
      let variant = null;
      let gstRate = product.gstRate || 0;
      let gstEnabled = product.gstEnabled || false;

      if (item.variantId && product.variants) {
        variant = product.variants.find(v => String(v._id) === String(item.variantId) || String(v.id) === String(item.variantId));
        if (variant) {
          price = item.price !== undefined ? Number(item.price) : (variant.salePrice || variant.price || variant.purchasePrice || price);
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
        cashierId,
        sellerId: req.user.role === 'seller' ? req.user.id : undefined,
        sellerSnapshot: await providers.receipt.getSnapshot(req.user)
      },
      items: validatedItems,
      payment: {
        method: payment.method || "cash",
        // Recorded mode only — cash maps to CASH, everything else to ONLINE.
        // No gateway is triggered or verified based on this field.
        paymentMode: (payment.method || "cash") === "cash" ? "CASH" : "ONLINE",
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
      // If Home Delivery, route through standard workflow starting at created. If Take Away, instantly complete.
      status: fulfillmentDetails?.type === "HOME_DELIVERY" ? "pending" : "delivered",
      workflowStatus: fulfillmentDetails?.type === "HOME_DELIVERY" ? "CREATED" : "DELIVERED",
    });

    await newOrder.save({ session });

    // 4. Dynamic Inventory Deduction (Hub or Seller stock based on Provider)
    for (const item of newOrder.items) {
      const deductResult = await providers.inventory.deductStock(item.product, item.variantId, item.quantity, session);
      if (!deductResult) {
        throw new Error(`Insufficient available stock for product ${item.name}.`);
      }
      
      // Since it's fulfilled from hub strictly
      item.hubReservedQty = 0; // Not going to reserve, directly deducting available
      item.vendorProcuredQty = 0;
    }

    // POS orders bypass hub procurement and delivery workflow entirely.
    newOrder.hubStatus = "inventory_reserved";
    newOrder.procurementRequired = false;

    // Take-away POS: mark complete locally — never route through delivery workflow.
    if (fulfillmentDetails?.type !== "HOME_DELIVERY") {
      newOrder.status = "delivered";
      newOrder.workflowStatus = "DELIVERED";
      newOrder.acceptedAt = new Date();
      newOrder.deliveredAt = new Date();
    }
    
    await newOrder.save({ session });

    // 5. Update session totals. Online is bookkeeping only and never
    // affects the physical cash drawer or creates a cash movement.
    if (newOrder.payment.paymentMode === "CASH" && posSessionId) {
      await recordCashMovement(
        posSessionId,
        cashierId,
        "SALES",
        newOrder.pricing.total,
        `POS Sale - Receipt: ${receiptNumber}`,
        newOrder.orderId,
        session
      );
    } else if (
      req.user.role === "seller" &&
      newOrder.payment.paymentMode === "ONLINE" &&
      posSessionId
    ) {
      activeSession.totalOnlineSales =
        (activeSession.totalOnlineSales || 0) + newOrder.pricing.total;
      await activeSession.save({ session });
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
      order: newOrder
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
