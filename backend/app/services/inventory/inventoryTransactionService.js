import mongoose from "mongoose";

export const buildRollbackToken = ({
  action,
  productId,
  variantId = null,
  hubId = null,
  sellerId = null,
  quantity,
  previousState = {},
  idempotencyKey = null,
}) => ({
  action,
  productId: productId ? String(productId) : null,
  variantId: variantId ? String(variantId) : null,
  hubId,
  sellerId: sellerId ? String(sellerId) : null,
  quantity,
  previousState,
  idempotencyKey,
  createdAt: new Date().toISOString(),
});

export const buildOperationResult = ({
  success,
  applied = true,
  action,
  productId,
  variantId = null,
  hubId = null,
  sellerId = null,
  quantity = 0,
  previousQty = {},
  newQty = {},
  reason = null,
  idempotencyKey = null,
  hubInventory = null,
  product = null,
  message = null,
}) => ({
  success,
  applied,
  action,
  productId: productId ? String(productId) : null,
  variantId: variantId ? String(variantId) : null,
  hubId,
  sellerId: sellerId ? String(sellerId) : null,
  quantity,
  previousQty,
  newQty,
  reason,
  idempotencyKey,
  hubInventory,
  product,
  message,
  rollbackToken: buildRollbackToken({
    action,
    productId,
    variantId,
    hubId,
    sellerId,
    quantity,
    previousState: previousQty,
    idempotencyKey,
  }),
  timestamp: new Date().toISOString(),
});

export const withInventorySession = async (session, callback) => {
  if (session) {
    return callback(session);
  }

  const localSession = await mongoose.startSession();
  localSession.startTransaction();
  try {
    const result = await callback(localSession);
    await localSession.commitTransaction();
    return result;
  } catch (error) {
    await localSession.abortTransaction();
    throw error;
  } finally {
    localSession.endSession();
  }
};
