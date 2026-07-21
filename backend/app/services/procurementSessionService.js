import ProcurementSession from "../models/procurementSession.js";
import PurchaseRequest from "../models/purchaseRequest.js";
import Product from "../models/product.js";
import { sellerAvailableForMasterVariant } from "./allocationEngine.js";

export const buildItemKey = (productId, variantId = null) =>
  `${String(productId)}::${variantId ? String(variantId) : "root"}`;

const toInt = (v) => Math.max(0, Number(v || 0));

export const RESERVATION_STATE = {
  NOT_RESERVED: "NOT_RESERVED",
  RESERVED: "RESERVED",
  RELEASED: "RELEASED",
  COMPLETED: "COMPLETED",
};

/** Allocation statuses that may hold SellerCommitted stock. */
export const STOCK_HOLDING_ALLOCATION_STATUSES = new Set(["allocated", "locked"]);

const ACTIVE_ALLOCATION_STATUSES = STOCK_HOLDING_ALLOCATION_STATUSES;

const normalizeReservationState = (allocation) =>
  String(allocation?.reservationState || RESERVATION_STATE.NOT_RESERVED);

export const isAllocationStockReserved = (allocation) =>
  normalizeReservationState(allocation) === RESERVATION_STATE.RESERVED &&
  toInt(allocation?.reservedQty) > 0;

export const canClaimAllocationReservation = (allocation) => {
  const state = normalizeReservationState(allocation);
  return state === RESERVATION_STATE.NOT_RESERVED || state === RESERVATION_STATE.RELEASED;
};

/** Atomically claim reservation slot — prevents double SellerCommitted. */
export const tryClaimAllocationReservation = async (procurementSessionId, allocationId, quantity) => {
  if (!procurementSessionId || !allocationId || toInt(quantity) <= 0) return false;

  const qty = toInt(quantity);
  const updated = await ProcurementSession.findOneAndUpdate(
    {
      _id: procurementSessionId,
      allocations: {
        $elemMatch: {
          allocationId: String(allocationId),
          reservationState: { $in: [RESERVATION_STATE.NOT_RESERVED, null, undefined] },
        },
      },
    },
    {
      $set: {
        "allocations.$.reservationState": RESERVATION_STATE.RESERVED,
        "allocations.$.reservedQty": qty,
      },
    },
    { new: true },
  );

  return Boolean(updated);
};

/** Undo a reservation claim when inventory engine commit fails. */
export const revertAllocationReservationClaim = async (procurementSessionId, allocationId) => {
  if (!procurementSessionId || !allocationId) return null;
  return ProcurementSession.findOneAndUpdate(
    {
      _id: procurementSessionId,
      allocations: {
        $elemMatch: {
          allocationId: String(allocationId),
          reservationState: RESERVATION_STATE.RESERVED,
        },
      },
    },
    {
      $set: {
        "allocations.$.reservationState": RESERVATION_STATE.NOT_RESERVED,
        "allocations.$.reservedQty": 0,
      },
    },
    { new: true },
  );
};

/** Mark reservation consumed after inward/QA completion. */
export const markAllocationReservationCompleted = async (procurementSessionId, allocationId) => {
  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session) return null;
  const allocation = (session.allocations || []).find((a) => a.allocationId === allocationId);
  if (!allocation) return null;
  allocation.reservationState = RESERVATION_STATE.COMPLETED;
  allocation.reservedQty = 0;
  await session.save();
  return allocation;
};

/**
 * Idempotent seller stock release for one allocation.
 * Must complete before retry. Skips if already RELEASED or NOT_RESERVED.
 */
export const releaseAllocationSellerStock = async ({
  procurementSessionId,
  allocationId,
  purchaseRequestId = null,
  orderId = null,
  quantity = null,
  eventType = "SELLER_REJECTED",
  reason = "allocation_release",
  actor = { type: "system" },
  transactionId = null,
}) => {
  if (!procurementSessionId || !allocationId) {
    return { skipped: true, reason: "missing_ids" };
  }

  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session) return { skipped: true, reason: "no_session" };

  const allocation = (session.allocations || []).find((a) => a.allocationId === allocationId);
  if (!allocation) return { skipped: true, reason: "no_allocation" };

  const state = normalizeReservationState(allocation);
  if (state === RESERVATION_STATE.RELEASED || state === RESERVATION_STATE.NOT_RESERVED) {
    return { skipped: true, reason: "already_released", reservationState: state };
  }
  if (state === RESERVATION_STATE.COMPLETED) {
    return { skipped: true, reason: "completed", reservationState: state };
  }

  const currentlyReserved = toInt(allocation.reservedQty || allocation.quantity);
  const releaseQty =
    quantity != null ? Math.min(toInt(quantity), currentlyReserved) : currentlyReserved;
  if (releaseQty <= 0) {
    allocation.reservationState = RESERVATION_STATE.RELEASED;
    allocation.reservedQty = 0;
    await session.save();
    return { skipped: true, reason: "zero_reserved", reservationState: RESERVATION_STATE.RELEASED };
  }

  const { executeRollbackEvent } = await import("./transactionEngine.js");
  const txnId =
    transactionId ||
    `alloc_release:${String(allocationId)}:${releaseQty}:${String(reason || "na")}`;

  await executeRollbackEvent({
    eventType,
    transactionId: txnId,
    orderId,
    purchaseRequestId,
    allocationId,
    quantity: releaseQty,
    reason,
    actor,
  });

  const remainingReserved = Math.max(0, currentlyReserved - releaseQty);
  allocation.reservedQty = remainingReserved;
  allocation.reservationState =
    remainingReserved > 0 ? RESERVATION_STATE.RESERVED : RESERVATION_STATE.RELEASED;
  await session.save();

  return {
    skipped: false,
    releasedQty: releaseQty,
    reservationState: allocation.reservationState,
    remainingReserved,
  };
};

/** Release every RESERVED allocation on a session (procurement failure / cancel). */
export const releaseAllReservedAllocations = async ({
  procurementSessionId,
  orderId = null,
  eventType = "SELLER_REJECTED",
  reason = "procurement_session_release",
  actor = { type: "system" },
}) => {
  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session) return [];

  const results = [];
  for (const allocation of session.allocations || []) {
    if (!isAllocationStockReserved(allocation)) continue;
    const prId = allocation.purchaseRequestId || null;
    // eslint-disable-next-line no-await-in-loop
    const result = await releaseAllocationSellerStock({
      procurementSessionId,
      allocationId: allocation.allocationId,
      purchaseRequestId: prId,
      orderId,
      eventType,
      reason,
      actor,
      transactionId: `session_release:${String(allocation.allocationId)}:${String(reason)}`,
    });
    results.push({ allocationId: allocation.allocationId, ...result });
  }
  return results;
};

/** Quantity still covered by in-flight allocations for an item (parallel split PRs). */
export const getActiveAllocatedQty = (session, itemKey) => {
  let total = 0;
  for (const alloc of session?.allocations || []) {
    if (alloc.itemKey !== itemKey) continue;
    if (!ACTIVE_ALLOCATION_STATUSES.has(String(alloc.status || ""))) continue;
    total += toInt(alloc.quantity);
  }
  return total;
};

/** Remaining shortage not yet covered by active in-flight PR allocations. */
export const getUncoveredRemainingQty = (session, itemKey) => {
  const item = session?.items?.find((row) => row.itemKey === itemKey);
  if (!item) return 0;
  return Math.max(0, toInt(item.remainingQty) - getActiveAllocatedQty(session, itemKey));
};

export const isInventoryCommittedForAllocation = (session, allocationId) => {
  const allocation = (session?.allocations || []).find(
    (a) => a.allocationId === String(allocationId),
  );
  if (allocation) return isAllocationStockReserved(allocation);
  return Boolean(session?.metadata?.inventoryCommits?.[String(allocationId)]);
};

export const markInventoryCommittedForAllocation = async (procurementSessionId, allocationId, quantity) => {
  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session || !allocationId) return null;
  session.metadata = session.metadata || {};
  session.metadata.inventoryCommits = session.metadata.inventoryCommits || {};
  session.metadata.inventoryCommits[String(allocationId)] = toInt(quantity);
  await session.save();
  return session;
};

export const revertAllocation = async ({ procurementSessionId, allocationId }) => {
  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session) return null;
  const allocation = (session.allocations || []).find((a) => a.allocationId === allocationId);
  if (!allocation || allocation.status !== "allocated") return allocation;

  const item = (session.items || []).find((row) => row.itemKey === allocation.itemKey);
  if (item) {
    item.remainingQty = toInt(item.remainingQty) + toInt(allocation.quantity);
    item.allocatedQty = Math.max(0, toInt(item.allocatedQty) - toInt(allocation.quantity));
  }
  allocation.status = "failed";
  allocation.reservationState = RESERVATION_STATE.NOT_RESERVED;
  allocation.reservedQty = 0;
  session.status = recomputeSessionStatus(session);
  await session.save();
  return allocation;
};

/** Vendors that already received an allocation (one PR chance per seller per session item). */
export const getAttemptedVendorIds = (session, itemKey) => {
  const attempted = new Set();
  for (const alloc of session?.allocations || []) {
    if (alloc.itemKey === itemKey && alloc.vendorId) {
      attempted.add(String(alloc.vendorId));
    }
  }
  return attempted;
};

/** Next eligible sellers: ranked list minus anyone already attempted in this session. */
export const getEligibleFallbackSellers = (session, itemKey, pr) => {
  const attempted = getAttemptedVendorIds(session, itemKey);

  const itemAllocations = (session?.allocations || [])
    .filter((a) => a.itemKey === itemKey)
    .sort((a, b) => toInt(a.retryNumber) - toInt(b.retryNumber));

  const orderedCandidates = [];

  if (itemAllocations.length > 0) {
    const first = itemAllocations[0];
    orderedCandidates.push(String(first.vendorId));
    for (const id of first.rankedSellers || []) {
      orderedCandidates.push(String(id));
    }
  }

  for (const id of pr?.rankedSellers || []) {
    orderedCandidates.push(String(id));
  }

  const metaRank = session?.metadata?.rankedSellerIdsByItem?.[itemKey];
  if (Array.isArray(metaRank)) {
    for (const id of metaRank) {
      orderedCandidates.push(String(id));
    }
  }

  const seen = new Set();
  const eligible = [];
  for (const id of orderedCandidates) {
    const sid = String(id || "").trim();
    if (!sid || sid === "undefined" || sid === "null") continue;
    if (attempted.has(sid) || seen.has(sid)) continue;
    seen.add(sid);
    eligible.push(sid);
  }

  return eligible;
};

export const persistRankedSellersForItem = async (procurementSessionId, itemKey, vendorIds = []) => {
  if (!procurementSessionId || !itemKey || !Array.isArray(vendorIds) || vendorIds.length === 0) {
    return null;
  }
  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session) return null;
  session.metadata = session.metadata || {};
  session.metadata.rankedSellerIdsByItem = session.metadata.rankedSellerIdsByItem || {};
  session.metadata.rankedSellerIdsByItem[itemKey] = vendorIds.map(String);
  await session.save();
  return session;
};

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
    if (duplicateEvent) {
      let existingPurchaseRequest = null;
      if (duplicateEvent.purchaseRequestId) {
        existingPurchaseRequest = await PurchaseRequest.findById(duplicateEvent.purchaseRequestId)
          .select("_id requestId allocationId retryNumber")
          .lean();
      }
      return { allocation: duplicateEvent, duplicate: true, existingPurchaseRequest };
    }
  }

  const requested = toInt(quantity);
  let allocQty = Math.min(requested, toInt(item.remainingQty));
  if (allocQty <= 0) return null;

  if (selectedSellerProductId) {
    const [sellerProduct, masterProduct] = await Promise.all([
      Product.findById(selectedSellerProductId)
        .select("variants stock committedStock sellerId")
        .lean(),
      Product.findById(productId).select("variants").lean(),
    ]);
    const sellerAvailable = sellerAvailableForMasterVariant(
      sellerProduct,
      variantId,
      masterProduct,
    );
    allocQty = Math.min(allocQty, toInt(sellerAvailable));
  }
  if (allocQty <= 0) return null;

  const vendorAlreadyAttempted = (session.allocations || []).some(
    (a) => a.itemKey === itemKey && String(a.vendorId) === String(vendorId),
  );
  if (vendorAlreadyAttempted) {
    return { duplicate: true, reason: "vendor_already_attempted", allocation: null };
  }

  const existingVendorPr = await PurchaseRequest.findOne({
    procurementSessionId: session._id,
    vendorId,
    "items.productId": productId,
  })
    .select("_id requestId allocationId retryNumber")
    .lean();

  if (existingVendorPr) {
    return {
      duplicate: true,
      reason: "existing_pr_for_vendor",
      existingPurchaseRequest: existingVendorPr,
      allocation: {
        allocationId: existingVendorPr.allocationId || null,
        quantity: allocQty,
        retryNumber: Number(existingVendorPr.retryNumber || retryNumber || 0),
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
    reservationState: RESERVATION_STATE.NOT_RESERVED,
    reservedQty: 0,
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
  if (allocation.completedQty >= toInt(allocation.quantity)) {
    allocation.status = "completed";
    allocation.reservationState = RESERVATION_STATE.COMPLETED;
    allocation.reservedQty = 0;
  }
  if (item) item.completedQty = Math.min(toInt(item.requiredQty), toInt(item.completedQty) + qty);
  session.status = recomputeSessionStatus(session);
  await session.save();
  return allocation;
};

/** Mark session completed when every item is fulfilled or has no uncovered remaining qty. */
export const evaluateProcurementSessionCompletion = async (procurementSessionId) => {
  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session) return null;

  const hasUncovered = (session.items || []).some(
    (item) => getUncoveredRemainingQty(session, item.itemKey) > 0,
  );
  const allFulfilled = (session.items || []).every(
    (item) =>
      toInt(item.remainingQty) <= 0 &&
      toInt(item.completedQty) >= toInt(item.requiredQty),
  );

  if (!hasUncovered && allFulfilled) {
    session.status = "completed";
    await session.save();
  }

  return session;
};
