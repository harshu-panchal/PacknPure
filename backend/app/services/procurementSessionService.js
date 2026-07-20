import ProcurementSession from "../models/procurementSession.js";
import PurchaseRequest from "../models/purchaseRequest.js";

const ACTIVE_PR_STATUSES = [
  "created",
  "seller_confirmed",
  "pickup_assigned",
  "picked",
  "hub_delivered",
  "received_at_hub",
];

export const buildItemKey = (productId, variantId = null) =>
  `${String(productId)}::${variantId ? String(variantId) : "root"}`;

const toInt = (v) => Math.max(0, Number(v || 0));

const recomputeSessionStatus = (sessionDoc) => {
  const items = Array.isArray(sessionDoc.items) ? sessionDoc.items : [];
  if (items.length === 0) return "completed";
  const totalRemaining = items.reduce((sum, item) => sum + toInt(item.remainingQty), 0);
  const totalRequired = items.reduce((sum, item) => sum + toInt(item.requiredQty), 0);
  const totalCompleted = items.reduce((sum, item) => sum + toInt(item.completedQty), 0);
  if (totalRemaining <= 0 && totalCompleted >= totalRequired) return "completed";
  return "open";
};

export const ensureProcurementSession = async ({ order, shortages = [], hubId }) => {
  if (!order?._id) return null;
  let session = await ProcurementSession.findOne({ orderId: order._id });
  if (!session) {
    session = await ProcurementSession.create({
      orderId: order._id,
      hubId: String(hubId || order.hubId || "MAIN_HUB"),
      status: "open",
      items: [],
      metadata: { orderCode: order.orderId || null },
    });
  }

  const byKey = new Map((session.items || []).map((i) => [i.itemKey, i]));
  for (const short of shortages) {
    const itemKey = buildItemKey(short.productId, short.variantId);
    const requiredQty = toInt(short.shortageQty || short.requiredQty);
    if (!byKey.has(itemKey)) {
      byKey.set(itemKey, {
        itemKey,
        productId: short.productId,
        variantId: short.variantId || null,
        requiredQty,
        remainingQty: requiredQty,
        allocatedQty: 0,
        acceptedQty: 0,
        rejectedQty: 0,
        completedQty: 0,
        failedQty: 0,
        retryCount: 0,
      });
    }
  }

  session.items = Array.from(byKey.values());
  session.status = recomputeSessionStatus(session);
  await session.save();
  return session;
};

export const reserveAllocation = async ({
  procurementSessionId,
  productId,
  variantId = null,
  quantity,
  vendorId,
  selectedSellerProductId = null,
  rankedSellers = [],
  retryNumber = 0,
  sourceAllocationId = null,
  reason = "initial_allocation",
  eventKey = null,
}) => {
  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session) return null;

  const itemKey = buildItemKey(productId, variantId);
  const item = session.items.find((row) => row.itemKey === itemKey);
  if (!item) return null;

  if (eventKey) {
    const duplicateEvent = (session.allocations || []).find((a) => a.eventKey === eventKey);
    if (duplicateEvent) return { allocation: duplicateEvent, duplicate: true };
  }

  const requested = toInt(quantity);
  const allocQty = Math.min(requested, toInt(item.remainingQty));
  if (allocQty <= 0) return null;

  const existing = await PurchaseRequest.findOne({
    procurementSessionId: session._id,
    vendorId,
    status: { $in: ACTIVE_PR_STATUSES },
    "items.productId": productId,
    "items.variantId": variantId || null,
    "items.shortageQty": allocQty,
  })
    .select("_id requestId allocationId retryNumber")
    .lean();

  if (existing) {
    return {
      duplicate: true,
      existingPurchaseRequest: existing,
      allocation: {
        allocationId: existing.allocationId || null,
        quantity: allocQty,
        retryNumber: Number(existing.retryNumber || retryNumber || 0),
      },
    };
  }

  const allocationId = `ALC-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  item.remainingQty = Math.max(0, toInt(item.remainingQty) - allocQty);
  item.allocatedQty = toInt(item.allocatedQty) + allocQty;
  if (retryNumber > 0) {
    item.retryCount = toInt(item.retryCount) + 1;
    session.retryCount = toInt(session.retryCount) + 1;
  }

  const allocation = {
    allocationId,
    itemKey,
    productId,
    variantId: variantId || null,
    quantity: allocQty,
    vendorId,
    selectedSellerProductId: selectedSellerProductId || null,
    retryNumber: toInt(retryNumber),
    sourceAllocationId: sourceAllocationId || null,
    rankedSellers,
    status: "allocated",
    acceptedQty: 0,
    rejectedQty: 0,
    completedQty: 0,
    reason,
    eventKey: eventKey || null,
  };
  session.allocations.push(allocation);
  session.status = recomputeSessionStatus(session);
  await session.save();
  return { allocation, duplicate: false };
};

export const attachPurchaseRequestAllocation = async ({
  procurementSessionId,
  allocationId,
  purchaseRequestId,
}) => {
  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session) return null;
  const allocation = (session.allocations || []).find((a) => a.allocationId === allocationId);
  if (!allocation) return null;
  allocation.purchaseRequestId = purchaseRequestId;
  await session.save();
  return allocation;
};

export const markAllocationFromSellerResponse = async ({
  procurementSessionId,
  allocationId,
  responseStatus,
  committedQty = null,
}) => {
  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session) return null;
  const allocation = (session.allocations || []).find((a) => a.allocationId === allocationId);
  if (!allocation) return null;
  if (["completed", "cancelled", "failed", "timed_out", "rejected"].includes(allocation.status)) {
    return allocation;
  }

  const item = (session.items || []).find((row) => row.itemKey === allocation.itemKey);
  if (!item) return allocation;

  const allocQty = toInt(allocation.quantity);
  let accepted = allocQty;
  if (responseStatus === "rejected") accepted = 0;
  if (responseStatus === "partial") accepted = Math.min(allocQty, toInt(committedQty));

  const rejected = Math.max(0, allocQty - accepted);
  allocation.acceptedQty = accepted;
  allocation.rejectedQty = rejected;

  if (responseStatus === "accepted") allocation.status = "locked";
  else if (responseStatus === "partial") allocation.status = accepted > 0 ? "locked" : "rejected";
  else allocation.status = "rejected";

  item.acceptedQty = toInt(item.acceptedQty) + accepted;
  if (rejected > 0) {
    item.rejectedQty = toInt(item.rejectedQty) + rejected;
    item.remainingQty = toInt(item.remainingQty) + rejected;
  }

  session.status = recomputeSessionStatus(session);
  await session.save();
  return allocation;
};

export const markAllocationTimeout = async ({ procurementSessionId, allocationId }) => {
  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session) return null;
  const allocation = (session.allocations || []).find((a) => a.allocationId === allocationId);
  if (!allocation) return null;
  if (["timed_out", "rejected", "completed", "cancelled", "failed"].includes(allocation.status)) {
    return allocation;
  }
  const item = (session.items || []).find((row) => row.itemKey === allocation.itemKey);
  const recoverQty = Math.max(0, toInt(allocation.quantity) - toInt(allocation.acceptedQty));
  allocation.status = "timed_out";
  allocation.rejectedQty = toInt(allocation.rejectedQty) + recoverQty;
  if (item && recoverQty > 0) {
    item.rejectedQty = toInt(item.rejectedQty) + recoverQty;
    item.remainingQty = toInt(item.remainingQty) + recoverQty;
  }
  session.status = recomputeSessionStatus(session);
  await session.save();
  return allocation;
};

export const markAllocationCompletedFromInward = async ({
  procurementSessionId,
  allocationId,
  completedQty,
}) => {
  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session) return null;
  const allocation = (session.allocations || []).find((a) => a.allocationId === allocationId);
  if (!allocation) return null;
  const item = (session.items || []).find((row) => row.itemKey === allocation.itemKey);
  const qty = Math.min(toInt(completedQty), toInt(allocation.quantity));
  allocation.completedQty = Math.max(toInt(allocation.completedQty), qty);
  if (allocation.completedQty >= toInt(allocation.quantity)) allocation.status = "completed";
  if (item) item.completedQty = Math.min(toInt(item.requiredQty), toInt(item.completedQty) + qty);
  session.status = recomputeSessionStatus(session);
  await session.save();
  return allocation;
};
