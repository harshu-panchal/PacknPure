/**
 * Standalone Manual PR inventory helpers.
 * Isolated from automated procurement / hubOrderOrchestrator compensation paths.
 * Controllers and the monitor job must use these for Manual PR commit/release only.
 */

export const MANUAL_PR_PRE_PICKUP_STATUSES = new Set(["created", "seller_confirmed"]);

export const MANUAL_PR_TERMINAL_STATUSES = new Set([
  "closed",
  "cancelled",
  "seller_rejected",
  "expired",
  "verified",
  "procurement_failed",
]);

export const isStandaloneManualPR = (pr) => {
  if (!pr) return false;
  if (pr.requestType === "manual") return true;
  return !pr.orderId;
};

export const assertStandaloneManualPR = (pr) => {
  if (!isStandaloneManualPR(pr)) {
    const err = new Error("Not a standalone manual purchase request");
    err.statusCode = 400;
    throw err;
  }
};

export const getManualPRLineReleaseQty = (item = {}) => {
  const qty = Number(
    item.committedQty ||
      item.shortageQty ||
      item.requestedQty ||
      item.requiredQty ||
      0,
  );
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
};

export const buildManualPRReleaseIdempotencyKey = (action, prId, item) => {
  const productId = String(item?.productId || item?.selectedSellerProductId || "unknown");
  const variantId = item?.variantId ? String(item.variantId) : "novar";
  return `manual_pr_${action}_release:${String(prId)}:${productId}:${variantId}`;
};

/**
 * Release every committed line on a Manual PR.
 * Never uses transactionEngine / items[0] single-allocation rollback.
 */
export const releaseAllManualPRCommitments = async ({
  pr,
  session = null,
  reason,
  action = "release",
}) => {
  if (!pr || !Array.isArray(pr.items) || pr.items.length === 0) {
    return { releasedLines: 0, totalQty: 0 };
  }

  const { releaseSellerCommit } = await import("./inventory/inventoryReleaseService.js");
  let releasedLines = 0;
  let totalQty = 0;

  for (const item of pr.items) {
    const releaseQty = getManualPRLineReleaseQty(item);
    if (releaseQty <= 0) continue;

    await releaseSellerCommit({
      productId: item.selectedSellerProductId || item.productId,
      variantId: item.variantId || null,
      quantity: releaseQty,
      session,
      sellerId: pr.vendorId,
      reason,
      idempotencyKey: buildManualPRReleaseIdempotencyKey(action, pr._id, item),
    });

    releasedLines += 1;
    totalQty += releaseQty;

    // Keep PR line fields consistent after physical release
    item.committedQty = 0;
    if (typeof item.remainingQty === "number") {
      item.remainingQty = 0;
    }
  }

  return { releasedLines, totalQty };
};

/**
 * Release only unpicked remainder after a Manual PR pickup (all lines).
 */
export const releaseManualPRUnpickedCommitments = async ({
  pr,
  session = null,
  reason = "manual_pr_pickup_partial_unfulfilled",
}) => {
  if (!pr || !Array.isArray(pr.items)) {
    return { releasedLines: 0, totalQty: 0 };
  }

  const { releaseSellerCommit } = await import("./inventory/inventoryReleaseService.js");
  let releasedLines = 0;
  let totalQty = 0;

  for (const item of pr.items) {
    const lineObj = item.toObject ? item.toObject() : item;
    const lineRequested = getManualPRLineReleaseQty(lineObj);
    const linePicked = Math.max(0, Number(lineObj.actualPickedQty || 0));
    const lineRemaining = Math.max(0, lineRequested - linePicked);
    if (lineRemaining <= 0) continue;

    await releaseSellerCommit({
      productId: lineObj.selectedSellerProductId || lineObj.productId,
      variantId: lineObj.variantId || null,
      quantity: lineRemaining,
      session,
      sellerId: pr.vendorId,
      reason,
      idempotencyKey: `manual_pr_pickup_partial:${String(pr._id)}:${String(lineObj.productId)}:${lineObj.variantId || "novar"}:${lineRemaining}`,
    });

    releasedLines += 1;
    totalQty += lineRemaining;
    item.committedQty = linePicked;
  }

  return { releasedLines, totalQty };
};

/**
 * Manual PR ownership transfer at Hub Receive (user lifecycle):
 * - Hub Available += acceptedQty (master product + master variant stock for Products HA)
 * - Seller Committed -= acceptedQty (seller product; stock already reduced at create)
 * Does NOT restore seller available stock (goods left the seller).
 *
 * Important: Admin Products HA badge reads master Product.variants[].stock
 * (not only HubInventory.availableQty). variantId must be the MASTER variant.
 */
export const transferManualPRInventoryAtHubReceive = async ({
  pr,
  masterProductId,
  sellerProductId,
  sellerVariantId = null,
  acceptedQty,
  hubId,
}) => {
  const qty = Math.max(0, Number(acceptedQty) || 0);
  if (qty <= 0) {
    return { applied: false, reason: "zero_qty" };
  }

  const Product = (await import("../models/product.js")).default;
  const { normalizeVariantMatchKey } = await import("../utils/productHelpers.js");
  const { receiveInventoryAtHub, moveSellerCommitToTransit } = await import(
    "./inventory/inventoryEngine.js"
  );

  const prId = String(pr._id);
  const masterId = String(masterProductId);
  const sellerId = String(sellerProductId);

  // Resolve seller variant → master variant (Products HA is keyed by master variant stock).
  let masterVariantId = null;
  if (sellerVariantId) {
    const [masterProduct, sellerProduct] = await Promise.all([
      Product.findById(masterId).select("variants").lean(),
      Product.findById(sellerId).select("variants").lean(),
    ]);
    const sellerVar = (sellerProduct?.variants || []).find(
      (v) => String(v._id || v.id) === String(sellerVariantId),
    );
    if (sellerVar?.name) {
      const key = normalizeVariantMatchKey(sellerVar.name);
      const masterVar = (masterProduct?.variants || []).find(
        (v) => normalizeVariantMatchKey(v.name) === key,
      );
      masterVariantId = masterVar?._id || masterVar?.id || null;
    }
    // Fallback: if seller listing IS the master (or ids equal), use seller variant directly.
    if (!masterVariantId && masterId === sellerId) {
      masterVariantId = sellerVariantId;
    }
  }

  const variantKey = masterVariantId
    ? String(masterVariantId)
    : sellerVariantId
      ? String(sellerVariantId)
      : "novar";

  // Pass masterVariantId so syncProductStock updates variants[].stock (Products HA source).
  await receiveInventoryAtHub({
    productId: masterId,
    variantId: masterVariantId,
    quantity: qty,
    hubId,
    reason: "manual_pr_hub_receive",
    idempotencyKey: `manual_pr_hub_ha_v2:${prId}:${masterId}:${variantKey}:${qty}`,
  });

  await moveSellerCommitToTransit({
    productId: sellerId,
    variantId: sellerVariantId || null,
    quantity: qty,
    sellerId: pr.vendorId,
    reason: "manual_pr_hub_receive_seller_commit_clear",
    idempotencyKey: `manual_pr_hub_sc_v2:${prId}:${sellerId}:${sellerVariantId || "novar"}:${qty}`,
  });

  return {
    applied: true,
    masterProductId: masterId,
    masterVariantId: masterVariantId ? String(masterVariantId) : null,
    sellerProductId: sellerId,
    quantity: qty,
  };
};

/**
 * Atomic Manual PR expiry: release ALL lines + set expired in one transaction.
 */
export const expireStandaloneManualPR = async (prId) => {
  const mongoose = (await import("mongoose")).default;
  const PurchaseRequest = (await import("../models/purchaseRequest.js")).default;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const pr = await PurchaseRequest.findOne({ _id: prId, status: "created" }).session(session);
    if (!pr || !isStandaloneManualPR(pr)) {
      await session.abortTransaction();
      return { expired: false };
    }

    await releaseAllManualPRCommitments({
      pr,
      session,
      reason: "manual_pr_expired",
      action: "expire",
    });

    pr.status = "expired";
    for (const item of pr.items || []) {
      item.committedQty = 0;
      item.remainingQty = 0;
    }
    await pr.save({ session });
    await session.commitTransaction();

    try {
      const { createNotification, createNotificationBatch } = await import("./notificationService.js");
      await createNotification({
        recipient: pr.vendorId,
        recipientModel: "Seller",
        title: "Manual PR Expired",
        message: `Manual purchase request ${pr.requestId} has expired.`,
        type: "manual_pr_expired",
        data: { purchaseRequestId: pr._id.toString(), requestId: pr.requestId },
      });
      await createNotification({
        recipient: pr.vendorId,
        recipientModel: "Seller",
        title: "Inventory Released",
        message: `Stock committed for purchase request ${pr.requestId} has been released.`,
        type: "manual_pr_inventory_released",
        data: { purchaseRequestId: pr._id.toString() },
      });
      const Admin = (await import("../models/admin.js")).default;
      const admins = await Admin.find({}).select("_id").lean();
      const adminIds = admins.map((a) => a?._id).filter(Boolean);
      if (adminIds.length) {
        await createNotificationBatch(
          adminIds.map((adminId) => ({
            recipient: adminId,
            recipientModel: "Admin",
            title: "Manual PR Expired",
            message: `Manual purchase request ${pr.requestId} has expired and committed stock has been released.`,
            type: "manual_pr_expired",
            data: { purchaseRequestId: pr._id.toString(), requestId: pr.requestId },
          })),
        );
      }
    } catch (notifErr) {
      console.error("[expireStandaloneManualPR] Notifications failed:", notifErr.message);
    }

    return { expired: true, pr };
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }
};
