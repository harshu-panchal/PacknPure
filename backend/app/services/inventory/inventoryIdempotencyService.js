import InventoryEvent from "../../models/inventoryEvent.js";

/**
 * Replay-safe guard for Inventory Engine mutations.
 * Returns stored result when the same idempotencyKey was already applied.
 */
export const getExistingInventoryMutation = async (idempotencyKey) => {
  if (!idempotencyKey) return null;
  const existing = await InventoryEvent.findOne({ idempotencyKey }).lean();
  if (!existing) return null;
  return {
    skipped: true,
    applied: Boolean(existing.applied),
    result: existing.result || {},
    event: existing,
  };
};

export const recordInventoryMutation = async ({
  idempotencyKey,
  action,
  productId = null,
  variantId = null,
  hubId = null,
  sellerId = null,
  orderId = null,
  purchaseRequestId = null,
  allocationId = null,
  quantity = 0,
  applied = true,
  result = {},
  reason = "",
}) => {
  if (!idempotencyKey) return null;
  try {
    return await InventoryEvent.create({
      idempotencyKey,
      action,
      productId: productId ? String(productId) : null,
      variantId: variantId ? String(variantId) : null,
      hubId,
      sellerId: sellerId ? String(sellerId) : null,
      orderId: orderId ? String(orderId) : null,
      purchaseRequestId: purchaseRequestId ? String(purchaseRequestId) : null,
      allocationId: allocationId ? String(allocationId) : null,
      quantity,
      applied,
      result,
      reason,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return getExistingInventoryMutation(idempotencyKey);
    }
    throw error;
  }
};

export const withInventoryIdempotency = async ({
  idempotencyKey,
  action,
  meta = {},
  execute,
}) => {
  if (idempotencyKey) {
    const existing = await getExistingInventoryMutation(idempotencyKey);
    if (existing) {
      return {
        ...(existing.result || {}),
        success: true,
        applied: existing.applied,
        skipped: true,
        reason: "already_applied",
        idempotencyKey,
      };
    }
  }

  const result = await execute();

  if (idempotencyKey) {
    await recordInventoryMutation({
      idempotencyKey,
      action,
      productId: meta.productId,
      variantId: meta.variantId,
      hubId: meta.hubId,
      sellerId: meta.sellerId,
      orderId: meta.orderId,
      purchaseRequestId: meta.purchaseRequestId,
      allocationId: meta.allocationId,
      quantity: meta.quantity ?? result?.quantity ?? 0,
      applied: Boolean(result?.applied ?? result?.success),
      result,
      reason: meta.reason || result?.reason || "",
    });
  }

  return result;
};
