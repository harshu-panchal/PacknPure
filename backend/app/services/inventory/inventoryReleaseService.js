import HubInventory from "../../models/hubInventory.js";
import {
  DEFAULT_HUB_ID,
  assertPositiveQuantity,
  validateHubInventoryExists,
  validateSufficientHubReserved,
  validateSufficientSellerCommitted,
  validateSufficientSellerAvailable,
  loadProduct,
} from "./inventoryValidationService.js";
import { syncProductStock, readProductStockSnapshot } from "./inventorySyncService.js";
import { logInventoryMovement } from "./inventoryLogger.js";
import { buildOperationResult } from "./inventoryTransactionService.js";
import {
  getExistingInventoryMutation,
  recordInventoryMutation,
  guardInventoryMutation,
} from "./inventoryIdempotencyService.js";

const hubInventoryStatus = (availableQty, reorderLevel = 10) => {
  const qty = Math.max(0, Number(availableQty) || 0);
  const reorder = Math.max(0, Number(reorderLevel) || 0);
  if (qty <= 0) return "out_of_stock";
  if (qty <= reorder) return "low_stock";
  return "healthy";
};

/**
 * Release hub reservation back to available.
 * Idempotent-safe: only releases up to current reservedQty.
 */
export const releaseHubReservation = async (opts) => {
  const {
    productId,
    variantId = null,
    quantity,
    hubId = DEFAULT_HUB_ID,
    session = null,
    reason = "release_hub_reservation",
    orderId = null,
    idempotencyKey = null,
  } = opts;

  return guardInventoryMutation({
    idempotencyKey,
    action: "release_hub_reservation",
    meta: { productId, variantId, hubId, orderId, quantity, reason },
    execute: async () => {
  const qty = assertPositiveQuantity(quantity);
  const hubInventory = await HubInventory.findOne({ productId, hubId }).session(session);

  if (!hubInventory) {
    return buildOperationResult({
      success: false,
      applied: false,
      action: "release_hub_reservation",
      productId,
      variantId,
      hubId,
      quantity: qty,
      reason: "hub_inventory_not_found",
      idempotencyKey,
    });
  }

  const previousQty = {
    availableQty: Math.max(0, Number(hubInventory.availableQty) || 0),
    reservedQty: Math.max(0, Number(hubInventory.reservedQty) || 0),
  };

  const releaseQty = Math.min(qty, previousQty.reservedQty);
  if (releaseQty <= 0) {
    logInventoryMovement({
      action: "release_hub_reservation",
      orderId,
      productId,
      variantId,
      hubId,
      quantity: qty,
      previousQty,
      newQty: previousQty,
      reason: "already_released",
      applied: false,
      idempotencyKey,
    });
    return buildOperationResult({
      success: true,
      applied: false,
      action: "release_hub_reservation",
      productId,
      variantId,
      hubId,
      quantity: qty,
      previousQty,
      newQty: previousQty,
      reason: "already_released",
      idempotencyKey,
      hubInventory,
    });
  }

  const updated = await HubInventory.findOneAndUpdate(
    { _id: hubInventory._id, reservedQty: { $gte: releaseQty } },
    { $inc: { reservedQty: -releaseQty, availableQty: releaseQty } },
    { new: true, session },
  );

  if (!updated) {
    return buildOperationResult({
      success: false,
      applied: false,
      action: "release_hub_reservation",
      productId,
      variantId,
      hubId,
      quantity: qty,
      previousQty,
      newQty: previousQty,
      reason: "concurrent_release_failed",
      idempotencyKey,
    });
  }

  try {
    await syncProductStock(productId, variantId, releaseQty, false, session);
  } catch (error) {
    console.warn("[InventoryEngine] Product stock mirroring failed:", error.message);
  }

  const newQty = {
    availableQty: Math.max(0, Number(updated.availableQty) || 0),
    reservedQty: Math.max(0, Number(updated.reservedQty) || 0),
  };

  logInventoryMovement({
    action: "release_hub_reservation",
    orderId,
    productId,
    variantId,
    hubId,
    quantity: releaseQty,
    previousQty,
    newQty,
    reason,
    idempotencyKey,
  });

  return buildOperationResult({
    success: true,
    applied: true,
    action: "release_hub_reservation",
    productId,
    variantId,
    hubId,
    quantity: releaseQty,
    previousQty,
    newQty,
    reason,
    idempotencyKey,
    hubInventory: updated,
  });
    },
  });
};

/**
 * Release seller committed stock back to available seller stock.
 */
export const releaseSellerCommit = async ({
  productId,
  variantId = null,
  quantity,
  session = null,
  reason = "release_seller_commit",
  orderId = null,
  sellerId = null,
  idempotencyKey = null,
}) => {
  if (idempotencyKey) {
    const replay = await getExistingInventoryMutation(idempotencyKey);
    if (replay?.result && Object.keys(replay.result).length > 0) {
      return { ...replay.result, skipped: true, idempotencyKey };
    }
  }

  const qty = assertPositiveQuantity(quantity);
  const product = await loadProduct(productId, session);
  const previousSnapshot = await readProductStockSnapshot(productId, variantId, session);
  const committedCheck = validateSufficientSellerCommitted(product, variantId, qty);
  const releaseQty = committedCheck.valid ? qty : Math.min(qty, committedCheck.committedStock);

  if (releaseQty <= 0) {
    logInventoryMovement({
      action: "release_seller_commit",
      orderId,
      productId,
      variantId,
      sellerId,
      quantity: qty,
      previousQty: previousSnapshot,
      newQty: previousSnapshot,
      reason: "already_released",
      applied: false,
      idempotencyKey,
    });
    return buildOperationResult({
      success: true,
      applied: false,
      action: "release_seller_commit",
      productId,
      variantId,
      sellerId,
      quantity: qty,
      previousQty: previousSnapshot,
      newQty: previousSnapshot,
      reason: "already_released",
      idempotencyKey,
    });
  }

  await syncProductStock(productId, variantId, releaseQty, false, session);
  await syncProductStock(productId, variantId, -releaseQty, true, session);

  const newSnapshot = await readProductStockSnapshot(productId, variantId, session);

  logInventoryMovement({
    action: "release_seller_commit",
    orderId,
    productId,
    variantId,
    sellerId,
    quantity: releaseQty,
    previousQty: previousSnapshot,
    newQty: newSnapshot,
    reason,
    idempotencyKey,
  });

  const result = buildOperationResult({
    success: true,
    applied: releaseQty > 0,
    action: "release_seller_commit",
    productId,
    variantId,
    sellerId,
    quantity: releaseQty,
    previousQty: previousSnapshot,
    newQty: newSnapshot,
    reason,
    idempotencyKey,
  });

  if (idempotencyKey && releaseQty > 0) {
    await recordInventoryMutation({
      idempotencyKey,
      action: "release_seller_commit",
      productId,
      variantId,
      sellerId,
      orderId,
      quantity: releaseQty,
      applied: true,
      result,
      reason,
    });
  }

  return result;
};

/**
 * After pickup: reduce committedStock only (stock was already deducted at commit).
 */
export const moveSellerCommitToTransit = async (opts) => {
  const {
    productId,
    variantId = null,
    quantity,
    session = null,
    reason = "move_seller_commit_to_transit",
    orderId = null,
    sellerId = null,
    idempotencyKey = null,
  } = opts;

  return guardInventoryMutation({
    idempotencyKey,
    action: "move_seller_commit_to_transit",
    meta: { productId, variantId, sellerId, orderId, quantity, reason },
    execute: async () => {
  const qty = assertPositiveQuantity(quantity);
  const product = await loadProduct(productId, session);
  const previousSnapshot = await readProductStockSnapshot(productId, variantId, session);
  const committedCheck = validateSufficientSellerCommitted(product, variantId, qty);
  const deductQty = committedCheck.valid ? qty : Math.min(qty, committedCheck.committedStock);

  if (deductQty <= 0) {
    logInventoryMovement({
      action: "move_seller_commit_to_transit",
      orderId,
      productId,
      variantId,
      sellerId,
      quantity: qty,
      previousQty: previousSnapshot,
      newQty: previousSnapshot,
      reason: "already_deducted",
      applied: false,
      idempotencyKey,
    });
    return buildOperationResult({
      success: true,
      applied: false,
      action: "move_seller_commit_to_transit",
      productId,
      variantId,
      sellerId,
      quantity: qty,
      previousQty: previousSnapshot,
      newQty: previousSnapshot,
      reason: "already_deducted",
      idempotencyKey,
    });
  }

  await syncProductStock(productId, variantId, -deductQty, true, session);

  const newSnapshot = await readProductStockSnapshot(productId, variantId, session);

  logInventoryMovement({
    action: "move_seller_commit_to_transit",
    orderId,
    productId,
    variantId,
    sellerId,
    quantity: deductQty,
    previousQty: previousSnapshot,
    newQty: newSnapshot,
    reason,
    idempotencyKey,
  });

  return buildOperationResult({
    success: true,
    applied: true,
    action: "move_seller_commit_to_transit",
    productId,
    variantId,
    sellerId,
    quantity: deductQty,
    previousQty: previousSnapshot,
    newQty: newSnapshot,
    reason,
    idempotencyKey,
  });
    },
  });
};

/**
 * Deduct hub available stock directly (POS / immediate sale).
 */
export const deductHubInventory = async (opts) => {
  const {
    productId,
    variantId = null,
    quantity,
    hubId = DEFAULT_HUB_ID,
    session = null,
    reason = "deduct_hub_inventory",
    orderId = null,
    idempotencyKey = null,
  } = opts;

  return guardInventoryMutation({
    idempotencyKey,
    action: "deduct_hub_inventory",
    meta: { productId, variantId, hubId, orderId, quantity, reason },
    execute: async () => {
  const qty = assertPositiveQuantity(quantity);
  const hubInventory = await HubInventory.findOne({ productId, hubId }).session(session);

  if (!hubInventory || hubInventory.availableQty < qty) {
    return buildOperationResult({
      success: false,
      applied: false,
      action: "deduct_hub_inventory",
      productId,
      variantId,
      hubId,
      quantity: qty,
      reason: "insufficient_available",
      idempotencyKey,
    });
  }

  const previousQty = {
    availableQty: Math.max(0, Number(hubInventory.availableQty) || 0),
    reservedQty: Math.max(0, Number(hubInventory.reservedQty) || 0),
  };

  const updated = await HubInventory.findOneAndUpdate(
    { _id: hubInventory._id, availableQty: { $gte: qty } },
    { $inc: { availableQty: -qty } },
    { new: true, session },
  );

  if (!updated) {
    return buildOperationResult({
      success: false,
      applied: false,
      action: "deduct_hub_inventory",
      productId,
      variantId,
      hubId,
      quantity: qty,
      previousQty,
      newQty: previousQty,
      reason: "concurrent_deduction_failed",
      idempotencyKey,
    });
  }

  try {
    await syncProductStock(productId, variantId, -qty, false, session);
  } catch (error) {
    console.warn("[InventoryEngine] Product stock mirroring failed:", error.message);
  }

  const newQty = {
    availableQty: Math.max(0, Number(updated.availableQty) || 0),
    reservedQty: Math.max(0, Number(updated.reservedQty) || 0),
  };

  logInventoryMovement({
    action: "deduct_hub_inventory",
    orderId,
    productId,
    variantId,
    hubId,
    quantity: qty,
    previousQty,
    newQty,
    reason,
    idempotencyKey,
  });

  return buildOperationResult({
    success: true,
    applied: true,
    action: "deduct_hub_inventory",
    productId,
    variantId,
    hubId,
    quantity: qty,
    previousQty,
    newQty,
    reason,
    idempotencyKey,
    hubInventory: updated,
  });
    },
  });
};

/**
 * Complete hub delivery: deduct reservedQty only.
 */
export const completeHubDelivery = async (opts) => {
  const {
    productId,
    quantity,
    hubId = DEFAULT_HUB_ID,
    session = null,
    reason = "complete_hub_delivery",
    orderId = null,
    idempotencyKey = null,
  } = opts;

  return guardInventoryMutation({
    idempotencyKey,
    action: "complete_hub_delivery",
    meta: { productId, hubId, orderId, quantity, reason },
    execute: async () => {
  const qty = assertPositiveQuantity(quantity);
  const hubInventory = await HubInventory.findOne({ productId, hubId }).session(session);

  if (!hubInventory) {
    return buildOperationResult({
      success: false,
      applied: false,
      action: "complete_hub_delivery",
      productId,
      hubId,
      quantity: qty,
      reason: "hub_inventory_not_found",
      idempotencyKey,
    });
  }

  const previousQty = {
    availableQty: Math.max(0, Number(hubInventory.availableQty) || 0),
    reservedQty: Math.max(0, Number(hubInventory.reservedQty) || 0),
  };

  const deductQty = Math.min(qty, previousQty.reservedQty);
  if (deductQty <= 0) {
    return buildOperationResult({
      success: true,
      applied: false,
      action: "complete_hub_delivery",
      productId,
      hubId,
      quantity: qty,
      previousQty,
      newQty: previousQty,
      reason: "already_delivered",
      idempotencyKey,
      hubInventory,
    });
  }

  const updated = await HubInventory.findOneAndUpdate(
    { _id: hubInventory._id, reservedQty: { $gte: deductQty } },
    { $inc: { reservedQty: -deductQty } },
    { new: true, session },
  );

  const newQty = updated
    ? {
        availableQty: Math.max(0, Number(updated.availableQty) || 0),
        reservedQty: Math.max(0, Number(updated.reservedQty) || 0),
      }
    : previousQty;

  logInventoryMovement({
    action: "complete_hub_delivery",
    orderId,
    productId,
    hubId,
    quantity: deductQty,
    previousQty,
    newQty,
    reason,
    idempotencyKey,
  });

  return buildOperationResult({
    success: Boolean(updated),
    applied: Boolean(updated),
    action: "complete_hub_delivery",
    productId,
    hubId,
    quantity: deductQty,
    previousQty,
    newQty,
    reason,
    idempotencyKey,
    hubInventory: updated,
  });
    },
  });
};

/**
 * Restore hub available stock (returns, POS restore, post-pickup cancellation).
 */
export const restoreHubAvailableInventory = async (opts) => {
  const {
    productId,
    variantId = null,
    quantity,
    hubId = DEFAULT_HUB_ID,
    session = null,
    reason = "restore_hub_available",
    orderId = null,
    idempotencyKey = null,
  } = opts;

  return guardInventoryMutation({
    idempotencyKey,
    action: "restore_hub_available",
    meta: { productId, variantId, hubId, orderId, quantity, reason },
    execute: async () => {
  const qty = assertPositiveQuantity(quantity);
  const existing = await HubInventory.findOne({ productId, hubId }).session(session);
  const previousQty = {
    availableQty: Math.max(0, Number(existing?.availableQty) || 0),
    reservedQty: Math.max(0, Number(existing?.reservedQty) || 0),
  };

  const updated = await HubInventory.findOneAndUpdate(
    { productId, hubId },
    { $inc: { availableQty: qty } },
    { new: true, upsert: true, session },
  );

  try {
    await syncProductStock(productId, variantId, qty, false, session);
  } catch (error) {
    console.warn("[InventoryEngine] Product stock mirroring failed:", error.message);
  }

  const newQty = {
    availableQty: Math.max(0, Number(updated.availableQty) || 0),
    reservedQty: Math.max(0, Number(updated.reservedQty) || 0),
  };

  logInventoryMovement({
    action: "restore_hub_available",
    orderId,
    productId,
    variantId,
    hubId,
    quantity: qty,
    previousQty,
    newQty,
    reason,
    idempotencyKey,
  });

  return buildOperationResult({
    success: true,
    applied: true,
    action: "restore_hub_available",
    productId,
    variantId,
    hubId,
    quantity: qty,
    previousQty,
    newQty,
    reason,
    idempotencyKey,
    hubInventory: updated,
  });
    },
  });
};

/**
 * Restore seller physical stock (returns, vendor return confirmation).
 */
export const restoreSellerInventory = async (opts) => {
  const {
    productId,
    variantId = null,
    quantity,
    session = null,
    reason = "restore_seller_inventory",
    orderId = null,
    sellerId = null,
    idempotencyKey = null,
  } = opts;

  return guardInventoryMutation({
    idempotencyKey,
    action: "restore_seller_inventory",
    meta: { productId, variantId, sellerId, orderId, quantity, reason },
    execute: async () => {
  const qty = assertPositiveQuantity(quantity);
  const previousSnapshot = await readProductStockSnapshot(productId, variantId, session);

  await syncProductStock(productId, variantId, qty, false, session);

  const newSnapshot = await readProductStockSnapshot(productId, variantId, session);

  logInventoryMovement({
    action: "restore_seller_inventory",
    orderId,
    productId,
    variantId,
    sellerId,
    quantity: qty,
    previousQty: previousSnapshot,
    newQty: newSnapshot,
    reason,
    idempotencyKey,
  });

  return buildOperationResult({
    success: true,
    applied: true,
    action: "restore_seller_inventory",
    productId,
    variantId,
    sellerId,
    quantity: qty,
    previousQty: previousSnapshot,
    newQty: newSnapshot,
    reason,
    idempotencyKey,
  });
    },
  });
};

/**
 * QA rejected units returned to seller.
 */
export const rejectQAInventory = async ({
  productId,
  variantId = null,
  quantity,
  session = null,
  reason = "reject_qa_inventory",
  orderId = null,
  sellerId = null,
  idempotencyKey = null,
}) => {
  return restoreSellerInventory({
    productId,
    variantId,
    quantity,
    session,
    reason,
    orderId,
    sellerId,
    idempotencyKey,
  });
};

/**
 * Manual hub stock adjustment (delta-based).
 */
export const adjustHubAvailableStock = async ({
  productId,
  variantId = null,
  delta,
  hubId = DEFAULT_HUB_ID,
  session = null,
  reason = "adjust_hub_available_stock",
  idempotencyKey = null,
}) => {
  const numericDelta = Number(delta);
  if (!Number.isFinite(numericDelta) || numericDelta === 0) {
    throw new (await import("./inventoryValidationService.js")).InventoryError(
      "delta must be a non-zero number",
      "INVALID_DELTA",
    );
  }

  if (numericDelta > 0) {
    const { addHubAvailableStock: addStock } = await import("./inventoryReservationService.js");
    return addStock({
      productId,
      variantId,
      quantity: numericDelta,
      hubId,
      session,
      reason,
      idempotencyKey,
    });
  }

  return deductHubInventory({
    productId,
    variantId,
    quantity: Math.abs(numericDelta),
    hubId,
    session,
    reason,
    idempotencyKey,
  });
};

/**
 * Set absolute hub available stock (admin catalog sync).
 */
export const setAdminHubStock = async (opts) => {
  const {
    productId,
    quantity,
    hubId = DEFAULT_HUB_ID,
    reorderLevel = 10,
    sellPrice = 0,
    session = null,
    reason = "set_admin_hub_stock",
    idempotencyKey = null,
  } = opts;

  return guardInventoryMutation({
    idempotencyKey,
    action: "set_admin_hub_stock",
    meta: { productId, hubId, quantity, reason },
    execute: async () => {
  const qty = Math.max(0, Number(quantity) || 0);
  const reorder = Math.max(0, Number(reorderLevel) || 0);

  const existing = await HubInventory.findOne({ hubId, productId }).session(session);
  const previousQty = {
    availableQty: Math.max(0, Number(existing?.availableQty) || 0),
    reservedQty: Math.max(0, Number(existing?.reservedQty) || 0),
  };

  const setFields = {
    availableQty: qty,
    status: hubInventoryStatus(qty, reorder),
    reorderLevel: reorder,
  };
  if (sellPrice > 0) {
    setFields.sellPrice = sellPrice;
    setFields.priceUpdatedAt = new Date();
  }

  const updated = await HubInventory.findOneAndUpdate(
    { hubId, productId },
    {
      $set: setFields,
      $setOnInsert: { reservedQty: 0 },
    },
    { upsert: true, new: true, session },
  );

  const newQty = {
    availableQty: Math.max(0, Number(updated.availableQty) || 0),
    reservedQty: Math.max(0, Number(updated.reservedQty) || 0),
  };

  logInventoryMovement({
    action: "set_admin_hub_stock",
    productId,
    hubId,
    quantity: qty,
    previousQty,
    newQty,
    reason,
    idempotencyKey,
  });

  return buildOperationResult({
    success: true,
    applied: true,
    action: "set_admin_hub_stock",
    productId,
    hubId,
    quantity: qty,
    previousQty,
    newQty,
    reason,
    idempotencyKey,
    hubInventory: updated,
  });
    },
  });
};

/**
 * Manual seller stock adjustment (delta or absolute).
 */
export const adjustSellerStock = async (opts) => {
  const {
    productId,
    variantId = null,
    delta = null,
    absoluteStock = null,
    session = null,
    reason = "adjust_seller_stock",
    sellerId = null,
    idempotencyKey = null,
  } = opts;

  return guardInventoryMutation({
    idempotencyKey,
    action: "adjust_seller_stock",
    meta: { productId, variantId, sellerId, reason },
    execute: async () => {
  const previousSnapshot = await readProductStockSnapshot(productId, variantId, session);
  let numericDelta = Number(delta);

  if (absoluteStock !== undefined && absoluteStock !== null && absoluteStock !== "") {
    const target = Math.max(0, Number(absoluteStock) || 0);
    numericDelta = target - previousSnapshot.stock;
  }

  if (!Number.isFinite(numericDelta) || numericDelta === 0) {
    return buildOperationResult({
      success: true,
      applied: false,
      action: "adjust_seller_stock",
      productId,
      variantId,
      sellerId,
      quantity: 0,
      previousQty: previousSnapshot,
      newQty: previousSnapshot,
      reason: "no_change",
      idempotencyKey,
    });
  }

  if (numericDelta < 0 && previousSnapshot.stock + numericDelta < 0) {
    throw new (await import("./inventoryValidationService.js")).InventoryError(
      "Stock cannot be negative",
      "INSUFFICIENT_SELLER_STOCK",
      { availableQty: previousSnapshot.stock, requestedDelta: numericDelta },
    );
  }

  await syncProductStock(productId, variantId, numericDelta, false, session);
  const newSnapshot = await readProductStockSnapshot(productId, variantId, session);

  logInventoryMovement({
    action: "adjust_seller_stock",
    productId,
    variantId,
    sellerId,
    quantity: Math.abs(numericDelta),
    previousQty: previousSnapshot,
    newQty: newSnapshot,
    reason,
    idempotencyKey,
  });

  return buildOperationResult({
    success: true,
    applied: true,
    action: "adjust_seller_stock",
    productId,
    variantId,
    sellerId,
    quantity: Math.abs(numericDelta),
    previousQty: previousSnapshot,
    newQty: newSnapshot,
    reason,
    idempotencyKey,
  });
    },
  });
};

/**
 * Deduct seller stock directly (seller POS).
 */
export const deductSellerInventory = async (opts) => {
  const {
    productId,
    variantId = null,
    quantity,
    session = null,
    reason = "deduct_seller_inventory",
    sellerId = null,
    idempotencyKey = null,
  } = opts;

  return guardInventoryMutation({
    idempotencyKey,
    action: "deduct_seller_inventory",
    meta: { productId, variantId, sellerId, quantity, reason },
    execute: async () => {
  const qty = assertPositiveQuantity(quantity);
  const product = await loadProduct(productId, session);
  validateSufficientSellerAvailable(product, variantId, qty);

  const previousSnapshot = await readProductStockSnapshot(productId, variantId, session);
  await syncProductStock(productId, variantId, -qty, false, session);
  const newSnapshot = await readProductStockSnapshot(productId, variantId, session);

  logInventoryMovement({
    action: "deduct_seller_inventory",
    productId,
    variantId,
    sellerId,
    quantity: qty,
    previousQty: previousSnapshot,
    newQty: newSnapshot,
    reason,
    idempotencyKey,
  });

  return buildOperationResult({
    success: true,
    applied: true,
    action: "deduct_seller_inventory",
    productId,
    variantId,
    sellerId,
    quantity: qty,
    previousQty: previousSnapshot,
    newQty: newSnapshot,
    reason,
    idempotencyKey,
  });
    },
  });
};
