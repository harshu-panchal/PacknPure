import mongoose from "mongoose";
import Setting from "../models/setting.js";
import Order from "../models/order.js";
import PurchaseRequest from "../models/purchaseRequest.js";
import ProcurementSession from "../models/procurementSession.js";
import RollbackRecord from "../models/rollbackRecord.js";
import {
  releaseHubReservation,
  releaseSellerCommit,
  restoreSellerInventory,
  withInventorySession,
} from "./inventory/inventoryEngine.js";
import { normalizeVariantMatchKey } from "../utils/productHelpers.js";

const ACTIVE_PR_STATUSES = ["created", "seller_confirmed", "pickup_assigned", "picked", "hub_delivered"];

const toQty = (value) => Math.max(0, Number(value || 0));

const newTransactionId = (eventType, orderId = "none", allocationId = "none") =>
  `${eventType}:${String(orderId)}:${String(allocationId)}:${Date.now()}`;

const buildIdempotencyKey = ({ eventType, orderId = null, allocationId = null, purchaseRequestId = null, reason = "" }) =>
  `${eventType}:${String(orderId || "none")}:${String(allocationId || "none")}:${String(purchaseRequestId || "none")}:${String(reason || "na")}`;

const resolveSellerVariantId = async ({
  sellerProductId,
  masterProductId,
  masterVariantId,
  session = null,
}) => {
  if (!sellerProductId || !masterVariantId) return null;
  const Product = (await import("../models/product.js")).default;
  const [master, seller] = await Promise.all([
    Product.findById(masterProductId).select("variants").session(session),
    Product.findById(sellerProductId).select("variants").session(session),
  ]);
  if (!master || !seller || !Array.isArray(master.variants) || !Array.isArray(seller.variants)) return null;
  const mVar = master.variants.find((v) => String(v._id) === String(masterVariantId) || String(v.id) === String(masterVariantId));
  if (!mVar) return null;
  const key = normalizeVariantMatchKey(mVar.name);
  const sVar = seller.variants.find((v) => normalizeVariantMatchKey(v.name) === key);
  return sVar?._id || null;
};

const createOrGetRecord = async ({
  transactionId,
  rollbackEvent,
  reason,
  orderId,
  purchaseRequestId = null,
  allocationId = null,
  actor = {},
  beforeState = {},
}) => {
  const existingByTxn = await RollbackRecord.findOne({ transactionId });
  if (existingByTxn) return { record: existingByTxn, duplicate: existingByTxn.status === "completed" || existingByTxn.status === "skipped" };

  const existingByScope = await RollbackRecord.findOne({
    rollbackEvent,
    orderId: orderId || null,
    purchaseRequestId: purchaseRequestId || null,
    allocationId: allocationId || null,
    status: { $in: ["completed", "skipped"] },
  });
  if (existingByScope) return { record: existingByScope, duplicate: true };

  const rec = await RollbackRecord.create({
    transactionId,
    rollbackEvent,
    reason,
    orderId: orderId || null,
    purchaseRequestId: purchaseRequestId || null,
    allocationId: allocationId || null,
    actorId: actor.id ? String(actor.id) : null,
    actorType: actor.type || "system",
    status: "started",
    beforeState,
    startedAt: new Date(),
  });
  return { record: rec, duplicate: false };
};

const completeRecord = async (recordId, status, operations, afterState, error = "") => {
  await RollbackRecord.findByIdAndUpdate(recordId, {
    $set: {
      status,
      operations,
      afterState,
      error,
      completedAt: new Date(),
    },
  });
};

const rollbackOrderReservations = async ({ order, session }) => {
  const operations = [];
  for (const item of order.items || []) {
    const variantId = item.variantId || null;
    if (!variantId) continue; // variant-level only
    const releasableQty = Math.max(
      0,
      Math.min(
        toQty(item.hubReservedQty),
        toQty(item.quantity) - toQty(item.deliveredQty || 0),
      ),
    );
    if (releasableQty <= 0) continue;
    const result = await releaseHubReservation({
      productId: item.product,
      variantId,
      quantity: releasableQty,
      session,
      orderId: order._id,
      reason: "transaction_engine_order_cancel",
      idempotencyKey: `order_cancel:${String(order._id)}:${String(item.product)}:${String(variantId)}`,
    });
    operations.push({
      action: "release_hub_reservation",
      productId: String(item.product),
      variantId: String(variantId),
      quantity: releasableQty,
      result,
    });
  }
  return operations;
};

const releasePendingProcurementAllocations = async ({
  order,
  releaseAccepted,
  session,
  rollbackEvent,
}) => {
  const operations = [];
  const procurementSession = order.procurementSessionId
    ? await ProcurementSession.findById(order.procurementSessionId).session(session)
    : null;

  const prs = await PurchaseRequest.find({
    orderId: order._id,
    status: { $in: ACTIVE_PR_STATUSES },
  }).session(session);

  for (const pr of prs) {
    const alloc = procurementSession?.allocations?.find((a) => a.allocationId === pr.allocationId) || null;
    const acceptedQty = alloc ? toQty(alloc.acceptedQty) : 0;
    const baseQty = alloc ? toQty(alloc.quantity) : toQty(pr.items?.[0]?.shortageQty);
    const releasableQty = releaseAccepted ? baseQty : Math.max(0, baseQty - acceptedQty);
    if (releasableQty <= 0) continue;

    const line = pr.items?.[0];
    if (!line?.variantId || !line?.selectedSellerProductId) continue; // variant-level only
    const sellerVariantId = await resolveSellerVariantId({
      sellerProductId: line.selectedSellerProductId,
      masterProductId: line.productId,
      masterVariantId: line.variantId,
      session,
    });

    const result = await releaseSellerCommit({
      productId: line.selectedSellerProductId,
      variantId: sellerVariantId || null,
      quantity: releasableQty,
      session,
      orderId: order._id,
      sellerId: pr.vendorId,
      reason: `transaction_engine_${rollbackEvent.toLowerCase()}`,
      idempotencyKey: `${rollbackEvent}:${String(order._id)}:${String(pr._id)}:${String(pr.allocationId || "none")}`,
    });

    operations.push({
      action: "release_seller_commit",
      productId: String(line.productId),
      sellerProductId: String(line.selectedSellerProductId),
      variantId: String(line.variantId),
      quantity: releasableQty,
      result,
    });

    if (rollbackEvent === "PROCUREMENT_FAILED" || rollbackEvent === "ORDER_CANCELLED" || rollbackEvent === "ORDER_EXPIRED" || rollbackEvent === "PAYMENT_FAILED") {
      pr.status = "cancelled";
      pr.exceptionReason = `rollback:${rollbackEvent}`;
      await pr.save({ session });
    }
  }

  if (procurementSession && rollbackEvent === "PROCUREMENT_FAILED") {
    procurementSession.status = releaseAccepted ? "failed" : "on_hold";
    await procurementSession.save({ session });
  }

  return operations;
};

const rollbackSingleAllocation = async ({
  rollbackEvent,
  purchaseRequestId,
  allocationId,
  quantity = null,
  session,
}) => {
  const pr = purchaseRequestId
    ? await PurchaseRequest.findById(purchaseRequestId).session(session)
    : await PurchaseRequest.findOne({ allocationId }).session(session);
  if (!pr) return [];

  const line = pr.items?.[0];
  if (!line?.variantId || !line?.selectedSellerProductId) return [];

  const qty =
    rollbackEvent === "SYSTEM_COMPENSATION"
      ? toQty(quantity ?? line.shortageQty)
      : Math.min(
          toQty(quantity ?? line.shortageQty),
          Math.max(0, toQty(line.shortageQty) - toQty(line.committedQty)),
        );
  if (qty <= 0) return [];

  const sellerVariantId = await resolveSellerVariantId({
    sellerProductId: line.selectedSellerProductId,
    masterProductId: line.productId,
    masterVariantId: line.variantId,
    session,
  });

  const result = await releaseSellerCommit({
    productId: line.selectedSellerProductId,
    variantId: sellerVariantId || null,
    quantity: qty,
    session,
    orderId: pr.orderId,
    sellerId: pr.vendorId,
    reason: `transaction_engine_${rollbackEvent.toLowerCase()}`,
    idempotencyKey: `${rollbackEvent}:${String(pr.orderId)}:${String(pr._id)}:${String(pr.allocationId || "none")}`,
  });

  return [
    {
      action: "release_seller_commit",
      productId: String(line.productId),
      sellerProductId: String(line.selectedSellerProductId),
      variantId: String(line.variantId),
      quantity: qty,
      result,
    },
  ];
};

export const executeRollbackEvent = async ({
  eventType,
  transactionId = null,
  reason = "",
  actor = {},
  orderId = null,
  purchaseRequestId = null,
  allocationId = null,
  quantity = null,
  metadata = {},
}) => {
  const rollbackEvent = String(eventType || "").toUpperCase();
  const resolvedTransactionId =
    transactionId || newTransactionId(rollbackEvent, orderId || "none", allocationId || purchaseRequestId || "none");
  const logicalKey = buildIdempotencyKey({
    eventType: rollbackEvent,
    orderId,
    allocationId,
    purchaseRequestId,
    reason,
  });

  const order = orderId ? await Order.findById(orderId) : null;
  const beforeState = {
    logicalKey,
    orderStatus: order?.status || null,
    workflowStatus: order?.workflowStatus || null,
    metadata,
  };

  const { record, duplicate } = await createOrGetRecord({
    transactionId: resolvedTransactionId,
    rollbackEvent,
    reason,
    orderId: orderId || null,
    purchaseRequestId,
    allocationId,
    actor,
    beforeState,
  });
  if (duplicate) {
    return {
      success: true,
      skipped: true,
      transactionId: resolvedTransactionId,
      reason: "already_processed",
    };
  }

  const mongoSession = await mongoose.startSession();
  let operations = [];
  try {
    await mongoSession.withTransaction(async () => {
      operations = await withInventorySession(mongoSession, async (inventorySession) => {
        if (rollbackEvent === "SYSTEM_COMPENSATION" && (purchaseRequestId || allocationId)) {
          return rollbackSingleAllocation({
            rollbackEvent,
            purchaseRequestId,
            allocationId,
            quantity,
            session: inventorySession,
          });
        }

        if (rollbackEvent === "ORDER_CANCELLED" || rollbackEvent === "ORDER_EXPIRED" || rollbackEvent === "PAYMENT_FAILED" || rollbackEvent === "SYSTEM_COMPENSATION") {
          if (!order) return [];
          const releaseOps = await rollbackOrderReservations({ order, session: inventorySession });
          const procurementOps = await releasePendingProcurementAllocations({
            order,
            releaseAccepted: rollbackEvent !== "PAYMENT_FAILED",
            session: inventorySession,
            rollbackEvent,
          });
          return [...releaseOps, ...procurementOps];
        }

        if (rollbackEvent === "PROCUREMENT_FAILED") {
          if (!order) return [];
          const settings = await Setting.findOne().lean().session(inventorySession);
          const autoCancel = settings?.procurementFailureAction === "auto_cancel";
          const releaseOps = autoCancel
            ? await rollbackOrderReservations({ order, session: inventorySession })
            : [];
          const procurementOps = await releasePendingProcurementAllocations({
            order,
            releaseAccepted: autoCancel,
            session: inventorySession,
            rollbackEvent,
          });
          if (autoCancel) {
            order.status = "cancelled";
            order.workflowStatus = "CANCELLED";
            order.cancelReason = "Procurement failed";
          } else {
            order.hubStatus = "on_hold";
          }
          await order.save({ session: inventorySession });
          return [...releaseOps, ...procurementOps];
        }

        if (rollbackEvent === "SELLER_REJECTED" || rollbackEvent === "SELLER_TIMEOUT") {
          return rollbackSingleAllocation({
            rollbackEvent,
            purchaseRequestId,
            allocationId,
            quantity,
            session: inventorySession,
          });
        }

        if (rollbackEvent === "QA_REJECTED") {
          if (!purchaseRequestId) return [];
          const pr = await PurchaseRequest.findById(purchaseRequestId).session(inventorySession);
          if (!pr) return [];
          const line = pr.items?.[0];
          if (!line?.variantId || !line?.selectedSellerProductId) return [];
          const sellerVariantId = await resolveSellerVariantId({
            sellerProductId: line.selectedSellerProductId,
            masterProductId: line.productId,
            masterVariantId: line.variantId,
            session: inventorySession,
          });
          const qtyToRestore = toQty(quantity);
          if (qtyToRestore <= 0) return [];
          const result = await restoreSellerInventory({
            productId: line.selectedSellerProductId,
            variantId: sellerVariantId || null,
            quantity: qtyToRestore,
            session: inventorySession,
            orderId: pr.orderId,
            sellerId: pr.vendorId,
            reason: "transaction_engine_qa_rejected",
            idempotencyKey: `qa_rejected:${String(pr._id)}:${qtyToRestore}`,
          });
          return [
            {
              action: "restore_seller_inventory",
              productId: String(line.productId),
              sellerProductId: String(line.selectedSellerProductId),
              variantId: String(line.variantId),
              quantity: qtyToRestore,
              result,
            },
          ];
        }

        return [];
      });
    });

    const afterState = {
      operationsCount: operations.length,
      orderStatus: orderId ? (await Order.findById(orderId).select("status workflowStatus hubStatus").lean()) : null,
    };
    await completeRecord(record._id, operations.length > 0 ? "completed" : "skipped", operations, afterState, "");

    console.log(
      "[TransactionEngine]",
      JSON.stringify({
        type: "ROLLBACK_EVENT",
        transactionId: resolvedTransactionId,
        rollbackEvent,
        orderId,
        purchaseRequestId,
        allocationId,
        operationsCount: operations.length,
        status: operations.length > 0 ? "completed" : "skipped",
        reason,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      success: true,
      skipped: operations.length === 0,
      transactionId: resolvedTransactionId,
      operations,
    };
  } catch (error) {
    await completeRecord(record._id, "failed", operations, {}, error.message || String(error));
    throw error;
  } finally {
    mongoSession.endSession();
  }
};
