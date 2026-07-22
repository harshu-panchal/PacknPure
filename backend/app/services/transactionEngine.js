import mongoose from "mongoose";
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
import { resolveSellerVariantId } from "../utils/productHelpers.js";
import { getProcurementFailureAction } from "./settingsService.js";
import {
  markOrderProcurementFailedCancelled,
  markOrderOnHold,
} from "./workflowFacade.js";

const ACTIVE_PR_STATUSES = ["created", "seller_confirmed", "pickup_assigned", "picked", "hub_delivered"];

/** Include terminal-but-still-holding statuses so auto-cancel can still release SC. */
const RELEASABLE_PR_STATUSES = [
  ...ACTIVE_PR_STATUSES,
  "expired",
  "seller_rejected",
  "seller_failed",
  "procurement_failed",
  "closed",
  "cancelled",
  "exception",
];

const PR_INVENTORY_RELEASE_EVENTS = new Set(["SELLER_REJECTED", "SELLER_TIMEOUT", "SYSTEM_COMPENSATION"]);

const toQty = (value) => Math.max(0, Number(value || 0));

const newTransactionId = (eventType, orderId = "none", allocationId = "none") =>
  `${eventType}:${String(orderId)}:${String(allocationId)}:${Date.now()}`;

const buildIdempotencyKey = ({ eventType, orderId = null, allocationId = null, purchaseRequestId = null, reason = "" }) =>
  `${eventType}:${String(orderId || "none")}:${String(allocationId || "none")}:${String(purchaseRequestId || "none")}:${String(reason || "na")}`;

const createOrGetRecord = async ({
  transactionId,
  rollbackEvent,
  reason,
  orderId,
  purchaseRequestId = null,
  allocationId = null,
  quantity = null,
  actor = {},
  beforeState = {},
}) => {
  const existingByTxn = await RollbackRecord.findOne({ transactionId });
  if (existingByTxn) return { record: existingByTxn, duplicate: existingByTxn.status === "completed" || existingByTxn.status === "skipped" };

  if (purchaseRequestId && PR_INVENTORY_RELEASE_EVENTS.has(rollbackEvent) && quantity == null) {
    const existingPrRelease = await RollbackRecord.findOne({
      purchaseRequestId,
      rollbackEvent: { $in: [...PR_INVENTORY_RELEASE_EVENTS] },
      status: { $in: ["completed", "skipped"] },
    });
    if (existingPrRelease) return { record: existingPrRelease, duplicate: true };
  }

  const existingByScope = await RollbackRecord.findOne({
    rollbackEvent,
    orderId: orderId || null,
    purchaseRequestId: purchaseRequestId || null,
    allocationId: allocationId || null,
    status: { $in: ["completed", "skipped"] },
  });
  if (existingByScope) {
    // Allow re-running procurement failure if the order is still open (prior attempt cancelled nothing).
    if (rollbackEvent === "PROCUREMENT_FAILED" && orderId) {
      const stillOpen = await Order.findOne({
        _id: orderId,
        status: { $nin: ["cancelled", "delivered"] },
      })
        .select("_id status")
        .lean();
      if (stillOpen) {
        // Fall through and create a new record with a unique transactionId suffix handled by caller.
      } else {
        return { record: existingByScope, duplicate: true };
      }
    } else {
      return { record: existingByScope, duplicate: true };
    }
  }

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
    const productId = item.product?._id || item.product;
    if (!productId) continue;

    const releasableQty = Math.max(
      0,
      Math.min(
        toQty(item.hubReservedQty) + toQty(item.qaAcceptedQty),
        toQty(item.quantity) - toQty(item.deliveredQty || 0),
      ),
    );
    if (releasableQty <= 0) continue;

    const result = await releaseHubReservation({
      productId,
      variantId,
      quantity: releasableQty,
      session,
      orderId: order._id,
      reason: "transaction_engine_order_cancel",
      idempotencyKey: `order_cancel:${String(order._id)}:${String(productId)}:${String(variantId || "root")}`,
    });
    operations.push({
      action: "release_hub_reservation",
      productId: String(productId),
      variantId: variantId ? String(variantId) : null,
      quantity: releasableQty,
      result,
    });

    item.hubReservedQty = 0;
    item.qaAcceptedQty = 0;
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
    status: { $in: RELEASABLE_PR_STATUSES },
  }).session(session);

  for (const pr of prs) {
    const lines = Array.isArray(pr.items) && pr.items.length > 0 ? pr.items : [null];
    for (const line of lines) {
      if (!line) continue;
      const lineAllocId = line.allocationId || pr.allocationId;
      const alloc =
        procurementSession?.allocations?.find((a) => a.allocationId === lineAllocId) || null;

      // Skip if allocation already released/completed at reservation layer
      const reservationState = String(alloc?.reservationState || "");
      if (reservationState === "RELEASED" || reservationState === "COMPLETED") continue;

      const acceptedQty = alloc ? toQty(alloc.acceptedQty) : toQty(line.committedQty);
      const baseQty = alloc
        ? toQty(alloc.reservedQty) || toQty(alloc.quantity)
        : toQty(line.shortageQty || line.requestedQty);
      const releasableQty = releaseAccepted ? baseQty : Math.max(0, baseQty - acceptedQty);
      if (releasableQty <= 0) continue;

      if (!line?.selectedSellerProductId) continue;
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
        idempotencyKey: `${rollbackEvent}:${String(order._id)}:${String(pr._id)}:${String(lineAllocId || "none")}`,
      });

      if (alloc) {
        alloc.reservationState = "RELEASED";
        alloc.reservedQty = 0;
      }

      operations.push({
        action: "release_seller_commit",
        productId: String(line.productId),
        sellerProductId: String(line.selectedSellerProductId),
        variantId: String(line.variantId),
        allocationId: String(lineAllocId || ""),
        quantity: releasableQty,
        result,
      });
    }

    if (
      rollbackEvent === "PROCUREMENT_FAILED" ||
      rollbackEvent === "ORDER_CANCELLED" ||
      rollbackEvent === "ORDER_EXPIRED" ||
      rollbackEvent === "PAYMENT_FAILED"
    ) {
      pr.status = "cancelled";
      pr.exceptionReason = `rollback:${rollbackEvent}`;
      await pr.save({ session });
    }
  }

  // Also release any session allocations still marked RESERVED (covers closed PRs / orphans)
  if (procurementSession && releaseAccepted) {
    for (const alloc of procurementSession.allocations || []) {
      if (String(alloc.reservationState) !== "RESERVED") continue;
      if (toQty(alloc.reservedQty) <= 0 && toQty(alloc.quantity) <= 0) continue;
      const already = operations.some((op) => op.allocationId === String(alloc.allocationId));
      if (already) continue;

      const sellerProductId = alloc.selectedSellerProductId;
      if (!sellerProductId) {
        alloc.reservationState = "RELEASED";
        alloc.reservedQty = 0;
        continue;
      }

      const sellerVariantId = await resolveSellerVariantId({
        sellerProductId,
        masterProductId: alloc.productId,
        masterVariantId: alloc.variantId,
        session,
      });
      const qty = toQty(alloc.reservedQty) || toQty(alloc.quantity);
      const result = await releaseSellerCommit({
        productId: sellerProductId,
        variantId: sellerVariantId || null,
        quantity: qty,
        session,
        orderId: order._id,
        reason: `transaction_engine_${rollbackEvent.toLowerCase()}_session_orphan`,
        idempotencyKey: `${rollbackEvent}:session:${String(order._id)}:${String(alloc.allocationId)}`,
      });
      alloc.reservationState = "RELEASED";
      alloc.reservedQty = 0;
      operations.push({
        action: "release_seller_commit",
        allocationId: String(alloc.allocationId),
        quantity: qty,
        result,
      });
    }
  }

  if (procurementSession && rollbackEvent === "PROCUREMENT_FAILED") {
    procurementSession.status = releaseAccepted ? "failed" : "on_hold";
    await procurementSession.save({ session });
  } else if (procurementSession && releaseAccepted) {
    await procurementSession.save({ session });
  }

  return operations;
};

const resolvePrLineForRollback = (pr, allocationId = null) => {
  if (!pr?.items?.length) return null;
  if (allocationId) {
    const byAlloc = pr.items.find(
      (row) => String(row.allocationId || "") === String(allocationId),
    );
    if (byAlloc) return byAlloc;
  }
  return pr.items[0];
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

  const line = resolvePrLineForRollback(pr, allocationId);
  if (!line?.selectedSellerProductId) return [];

  const qty =
    quantity != null
      ? toQty(quantity)
      : rollbackEvent === "SYSTEM_COMPENSATION"
        ? toQty(line.shortageQty)
        : toQty(line.shortageQty);
  if (qty <= 0) return [];

  const lineAllocationId = line.allocationId || pr.allocationId || allocationId;
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
    idempotencyKey: `inv_release:${rollbackEvent}:${String(pr._id)}:${String(lineAllocationId || "none")}:${qty}`,
  });

  return [
    {
      action: "release_seller_commit",
      productId: String(line.productId),
      sellerProductId: String(line.selectedSellerProductId),
      variantId: String(line.variantId),
      allocationId: String(lineAllocationId || ""),
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
    quantity,
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
          const autoCancel = (await getProcurementFailureAction()) === "auto_cancel";
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
            markOrderProcurementFailedCancelled(order, { reason: "Procurement failed" });
          } else {
            markOrderOnHold(order, { reason: "Procurement failed" });
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
          const line = resolvePrLineForRollback(pr, allocationId);
          if (!line?.selectedSellerProductId) return [];
          const sellerVariantId = await resolveSellerVariantId({
            sellerProductId: line.selectedSellerProductId,
            masterProductId: line.productId,
            masterVariantId: line.variantId,
            session: inventorySession,
          });
          const qtyToRestore = toQty(quantity);
          if (qtyToRestore <= 0) return [];
          const lineAllocationId = line.allocationId || pr.allocationId || allocationId;
          const result = await restoreSellerInventory({
            productId: line.selectedSellerProductId,
            variantId: sellerVariantId || null,
            quantity: qtyToRestore,
            session: inventorySession,
            orderId: pr.orderId,
            sellerId: pr.vendorId,
            reason: "transaction_engine_qa_rejected",
            idempotencyKey: `qa_rejected:${String(pr._id)}:${String(lineAllocationId || "none")}:${qtyToRestore}`,
          });
          return [
            {
              action: "restore_seller_inventory",
              productId: String(line.productId),
              sellerProductId: String(line.selectedSellerProductId),
              variantId: String(line.variantId),
              allocationId: String(lineAllocationId || ""),
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
