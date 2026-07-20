export const logInventoryMovement = ({
  action,
  orderId = null,
  productId = null,
  variantId = null,
  hubId = null,
  sellerId = null,
  previousQty = null,
  newQty = null,
  quantity = null,
  reason = null,
  applied = true,
  idempotencyKey = null,
  metadata = {},
}) => {
  const entry = {
    type: "INVENTORY_MOVEMENT",
    action,
    orderId: orderId ? String(orderId) : null,
    productId: productId ? String(productId) : null,
    variantId: variantId ? String(variantId) : null,
    hubId,
    sellerId: sellerId ? String(sellerId) : null,
    quantity,
    previousQty,
    newQty,
    applied,
    reason,
    idempotencyKey,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  console.log("[InventoryEngine]", JSON.stringify(entry));
  return entry;
};
