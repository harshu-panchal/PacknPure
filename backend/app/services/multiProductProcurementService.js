import { createPurchaseRequest } from "./purchaseRequestRepository.js";
import {
  buildItemKey,
  reserveAllocation,
  attachPurchaseRequestAllocation,
  revertAllocation,
  releaseAllocationSellerStock,
} from "./procurementSessionService.js";

const toInt = (v) => Math.max(0, Number(v || 0));

export const buildPrLineKey = (productId, variantId = null) =>
  buildItemKey(productId, variantId);

export const normalizePrLine = (line) => (line?.toObject ? line.toObject() : line);

export const isRetryEligibleLineStatus = (status) => {
  const s = String(status || "").toLowerCase();
  return s === "rejected" || s === "partial";
};

export const isPickupEligibleLine = (line) => {
  const row = normalizePrLine(line);
  const status = String(row.lineStatus || "pending").toLowerCase();
  const committed = toInt(row.committedQty);
  return committed > 0 && (status === "accepted" || status === "partial");
};

export const applyLineSellerQuantities = (line, committedQty) => {
  const row = normalizePrLine(line);
  const productId = row.productId?._id || row.productId;
  const requestedQty = toInt(row.requestedQty || row.shortageQty);
  const accepted = Math.min(requestedQty, Math.max(0, toInt(committedQty)));
  const rejectedQty = Math.max(0, requestedQty - accepted);
  const remainingQty = rejectedQty;
  const lineStatus = deriveLineResponseStatus(accepted, requestedQty);
  return {
    ...row,
    productId,
    itemKey: row.itemKey || buildItemKey(productId, row.variantId),
    requestedQty,
    committedQty: accepted,
    rejectedQty,
    remainingQty,
    lineStatus,
  };
};

export const syncPrAggregateStatus = (pr, { notes = "", rejectionReason = "", sellerId = null } = {}) => {
  const lines = (pr.items || []).map(normalizePrLine);
  const pending = lines.filter((l) => String(l.lineStatus || "pending") === "pending");
  const anyCommitted = lines.some((l) => toInt(l.committedQty) > 0);

  if (pending.length > 0) {
    if (!["pickup_assigned", "picked"].includes(String(pr.status))) {
      pr.status = "created";
    }
    pr.vendorResponse = {
      ...(pr.vendorResponse || {}),
      status: "pending",
      notes: String(notes || pr.vendorResponse?.notes || ""),
    };
    return pr;
  }

  const allAccepted = lines.every((l) => l.lineStatus === "accepted");
  const allRejected = lines.every((l) => l.lineStatus === "rejected");

  pr.vendorResponse = {
    status: allAccepted ? "accepted" : allRejected ? "rejected" : "partial",
    respondedAt: new Date(),
    rejectionReason: allRejected ? String(rejectionReason || "Rejected by seller") : "",
    notes: String(notes || ""),
  };

  if (allRejected) {
    pr.status = "seller_rejected";
    pr.exceptionReason = String(rejectionReason || "Rejected by seller");
  } else if (!["pickup_assigned", "picked", "hub_delivered"].includes(String(pr.status))) {
    pr.status = "seller_confirmed";
    pr.exceptionReason = "";
  }

  return pr;
};

/** True when more than one distinct product/variant needs procurement. */
export const isMultiProductProcurementOrder = (shortages = []) => {
  const keys = new Set(
    shortages
      .filter((row) => toInt(row.shortageQty) > 0)
      .map((row) => buildItemKey(row.productId, row.variantId)),
  );
  return keys.size > 1;
};

/** Group enriched shortage rows by vendor for seller-wise PR creation. */
export const groupEnrichedShortagesByVendor = (enrichedShortages = []) => {
  const groups = new Map();
  for (const item of enrichedShortages) {
    if (!item.vendorId) continue;
    const vendorId = String(item.vendorId);
    if (!groups.has(vendorId)) groups.set(vendorId, []);
    groups.get(vendorId).push(item);
  }
  return groups;
};

export const buildPurchaseRequestItemPayload = (item, actualQty) => ({
  productId: item.productId,
  variantId: item.variantId || undefined,
  requiredQty: item.requiredQty,
  availableQtyAtHub: item.availableQtyAtHub,
  shortageQty: actualQty,
  requestedQty: actualQty,
  remainingQty: actualQty,
  committedQty: 0,
  selectedSellerProductId: item.selectedSellerProductId || undefined,
  vendorUnitCost: item.vendorUnitCost || 0,
  vendorQuotedPrice: item.vendorQuotedPrice || 0,
  pricingStrategy: item.pricingStrategy || "",
  gstRate: item.gstRate || 0,
  gstAmount: item.gstAmount || 0,
  baseSupplyPrice: item.baseSupplyPrice || 0,
  finalSupplyPrice: item.finalSupplyPrice || 0,
  totalProcurementCost: (item.finalSupplyPrice || 0) * actualQty,
  lineStatus: "pending",
  itemKey: buildItemKey(item.productId, item.variantId),
});

/**
 * Create seller-wise grouped PRs for multi-product orders.
 * One PR per vendor; each PR may contain multiple product lines.
 */
export const createSellerGroupedPurchaseRequests = async ({
  order,
  enrichedShortages,
  procurementSession,
  hubId,
  sellerResponseTimeout,
  commitSellerStockForPrLine,
  buildRequestId,
}) => {
  const vendorGroups = groupEnrichedShortagesByVendor(enrichedShortages);
  const insertedDocs = [];

  for (const [vendorId, vendorItems] of vendorGroups.entries()) {
    const preparedLines = [];

    for (const item of vendorItems) {
      const reserved = procurementSession
        ? await reserveAllocation({
            procurementSessionId: procurementSession._id,
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: item.shortageQty,
            vendorId: item.vendorId,
            selectedSellerProductId: item.selectedSellerProductId || null,
            rankedSellers: item.rankedSellers || [],
            retryNumber: 0,
            reason: "initial_allocation",
            eventKey: `initial:${String(order._id)}:${String(item.productId)}:${String(item.variantId || "root")}:${String(item.vendorId)}:${Number(item.shortageQty || 0)}`,
          })
        : null;

      if (reserved?.duplicate && reserved.existingPurchaseRequest) {
        continue;
      }
      if (procurementSession && !reserved?.allocation) {
        continue;
      }

      const allocationId = reserved?.allocation?.allocationId;
      const actualQty = toInt(reserved?.allocation?.quantity || item.shortageQty);

      if (item.selectedSellerProductId) {
        try {
          const commitResult = await commitSellerStockForPrLine({
            selectedSellerProductId: item.selectedSellerProductId,
            masterProduct: item.baseProduct,
            masterProductId: item.productId,
            masterVariantId: item.variantId || null,
            quantity: actualQty,
            procurementSessionId: procurementSession?._id || null,
            allocationId,
          });
          if (!commitResult?.committed) {
            if (procurementSession && allocationId) {
              await revertAllocation({
                procurementSessionId: procurementSession._id,
                allocationId,
              });
            }
            continue;
          }
        } catch (err) {
          console.warn(
            "[createSellerGroupedPurchaseRequests] Seller commit failed, reverting allocation:",
            err.message,
          );
          if (procurementSession && allocationId) {
            await revertAllocation({
              procurementSessionId: procurementSession._id,
              allocationId,
            });
          }
          continue;
        }
      }

      preparedLines.push({
        item,
        allocationId,
        actualQty,
        retryNumber: Number(reserved?.allocation?.retryNumber || 0),
      });
    }

    if (preparedLines.length === 0) continue;

    const mergedRankedSellers = [];
    const seenRank = new Set();
    for (const row of preparedLines) {
      for (const id of row.item.rankedSellers || []) {
        const sid = String(id);
        if (!seenRank.has(sid)) {
          seenRank.add(sid);
          mergedRankedSellers.push(id);
        }
      }
    }

    const prItems = preparedLines.map(({ item, allocationId, actualQty }) => ({
      ...buildPurchaseRequestItemPayload(item, actualQty),
      allocationId,
    }));

    const doc = await createPurchaseRequest({
      requestId: buildRequestId(),
      orderId: order._id,
      procurementSessionId: procurementSession?._id || undefined,
      allocationId: preparedLines[0].allocationId || undefined,
      retryNumber: preparedLines[0].retryNumber,
      hubId,
      vendorId,
      rankedSellers: mergedRankedSellers,
      status: "created",
      expiresAt: new Date(Date.now() + sellerResponseTimeout * 60 * 1000),
      items: prItems,
      notes: `Multi-product PR for order ${order.orderId} (${preparedLines.length} items)`,
    });

    if (procurementSession) {
      for (const row of preparedLines) {
        if (row.allocationId) {
          await attachPurchaseRequestAllocation({
            procurementSessionId: procurementSession._id,
            allocationId: row.allocationId,
            purchaseRequestId: doc._id,
          });
        }
      }
    }

    insertedDocs.push(doc);
  }

  return insertedDocs;
};

/** Every order line is physically available at hub (hub reserved + QA accepted). */
export const isOrderInventoryReadyForDelivery = (order) => {
  for (const item of order?.items || []) {
    const required = toInt(item.quantity);
    const available = toInt(item.hubReservedQty) + toInt(item.qaAcceptedQty);
    if (available < required) return false;
  }
  return (order?.items || []).length > 0;
};

/** Procurement session has fulfilled every product line. */
export const isProcurementSessionFullyComplete = (session) => {
  if (!session?.items?.length) return false;
  return session.items.every(
    (item) =>
      toInt(item.remainingQty) <= 0 &&
      toInt(item.completedQty) >= toInt(item.requiredQty),
  );
};

export const deriveLineResponseStatus = (committedQty, shortageQty) => {
  const shortage = toInt(shortageQty);
  const committed = Math.min(shortage, toInt(committedQty));
  if (committed <= 0) return "rejected";
  if (committed >= shortage) return "accepted";
  return "partial";
};

/** Release reserved stock, then retry — never retry while RESERVED. */
export const releaseLineAndRetry = async ({
  pr,
  lineObj,
  sellerId,
  executeRollbackEvent: _unused,
  markAllocationFromSellerResponse,
  fallbackPurchaseRequestLine,
  skipAllocationMark = false,
  eventType = "SELLER_REJECTED",
  reason = "seller_line_release",
}) => {
  const lineStatus =
    lineObj.lineStatus ||
    deriveLineResponseStatus(lineObj.committedQty, lineObj.shortageQty || lineObj.requestedQty);

  if (!isRetryEligibleLineStatus(lineStatus)) return false;

  const allocId = lineObj.allocationId || pr.allocationId;
  const retryQty =
    toInt(lineObj.remainingQty) ||
    Math.max(
      0,
      toInt(lineObj.requestedQty || lineObj.shortageQty) - toInt(lineObj.committedQty),
    );
  if (retryQty <= 0) return false;

  if (!skipAllocationMark && pr.procurementSessionId && allocId) {
    await markAllocationFromSellerResponse({
      procurementSessionId: pr.procurementSessionId,
      allocationId: allocId,
      responseStatus: lineStatus === "partial" ? "partial" : "rejected",
      committedQty: toInt(lineObj.committedQty),
    });
  }

  if (pr.procurementSessionId && allocId) {
    const releaseQty =
      lineStatus === "partial"
        ? retryQty
        : toInt(lineObj.requestedQty || lineObj.shortageQty || lineObj.remainingQty);

    await releaseAllocationSellerStock({
      procurementSessionId: pr.procurementSessionId,
      allocationId: allocId,
      purchaseRequestId: pr._id,
      orderId: pr.orderId || null,
      quantity: releaseQty,
      eventType,
      reason,
      actor: { id: sellerId, type: "seller" },
      transactionId: `pr_release:${String(pr._id)}:${String(allocId)}:${releaseQty}`,
    });
  }

  const productId = lineObj.productId?._id || lineObj.productId;
  await fallbackPurchaseRequestLine(
    pr._id,
    productId,
    lineObj.variantId || null,
    retryQty,
  );
  return true;
};

/** Release inventory and reallocate rejected/partial lines — never retries accepted lines. */
export const processRejectedLinesForFallback = async (params) => {
  for (const line of params.pr.items || []) {
    const lineObj = normalizePrLine(line);
    // eslint-disable-next-line no-await-in-loop
    await releaseLineAndRetry({ ...params, lineObj });
  }
  return (params.pr.items || []).length > 1;
};
