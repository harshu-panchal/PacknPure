import mongoose from "mongoose";
import Order from "../models/order.js";
import PosIdempotency from "../models/posIdempotency.js";
import { generateReceiptNumber, generateInvoiceNumber } from "../services/posSequenceService.js";
import { recordCashMovement } from "../services/posSessionService.js";
import { logPosAction } from "../services/posAuditService.js";
import { handleResponse } from "../utils/helper.js";
import { planHubFulfillment, reserveHubInventory, createAutoPurchaseRequests } from "../services/hubOrderOrchestrator.js";
import crypto from "crypto";

const hashPayload = (payload) => {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
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
      pricing, 
      guestCustomer, 
      posDetails,
      discountDetails
    } = req.body;

    const { posTerminalId, posSessionId } = posDetails || {};

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
      posDetails: {
        posTerminalId,
        posSessionId,
        cashierId
      },
      items,
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
      // Status lifecycle bypasses delivery routing
      status: "delivered", // Resolving to delivered directly for POS walk-in
      workflowStatus: "DELIVERED",
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

    // Auto-procure shortages just like online orders
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

    // Step through lifecycle rapidly to bypass physical shipping but preserve analytics
    newOrder.status = "delivered";
    newOrder.workflowStatus = "DELIVERED";
    newOrder.acceptedAt = new Date();
    newOrder.deliveredAt = new Date();
    
    await newOrder.save({ session });
    
    // Since we are instantly completing a POS order, deduct the reserved stock permanently.
    const { deductHubInventory } = await import("../services/inventoryLifecycleService.js");
    for (const alloc of hubPlan.allocations) {
       await deductHubInventory(alloc.productId, alloc.variantId, alloc.reserveQty, session);
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
