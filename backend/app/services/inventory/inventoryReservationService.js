import HubInventory from "../../models/hubInventory.js";
import {
  DEFAULT_HUB_ID,
  assertPositiveQuantity,
  validateHubInventoryExists,
  validateSufficientHubAvailable,
  validateSufficientSellerAvailable,
  loadProduct,
} from "./inventoryValidationService.js";
import { syncProductStock } from "./inventorySyncService.js";
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
 * Reserve hub stock: availableQty -> reservedQty.
 * Idempotent-safe: fails without mutation when insufficient available stock.
 */
export const reserveHubStock = async ({
  productId,
  variantId = null,
  quantity,
  hubId = DEFAULT_HUB_ID,
  session = null,
  reason = "reserve_hub_stock",
  orderId = null,
  idempotencyKey = null,
}) => {
  if (idempotencyKey) {
    const replay = await getExistingInventoryMutation(idempotencyKey);
    if (replay?.result && Object.keys(replay.result).length > 0) {
      return { ...replay.result, skipped: true, idempotencyKey };
    }
  }

  const qty = assertPositiveQuantity(quantity);

  const hubInventory = await HubInventory.findOne({ productId, hubId }).session(session);
  if (!hubInventory) {
    return buildOperationResult({
      success: false,
      applied: false,
      action: "reserve_hub_stock",
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

  if (previousQty.availableQty < qty) {
    logInventoryMovement({
      action: "reserve_hub_stock",
      orderId,
      productId,
      variantId,
      hubId,
      quantity: qty,
      previousQty,
      newQty: previousQty,
      reason: "insufficient_available",
      applied: false,
      idempotencyKey,
    });
    return buildOperationResult({
      success: false,
      applied: false,
      action: "reserve_hub_stock",
      productId,
      variantId,
      hubId,
      quantity: qty,
      previousQty,
      newQty: previousQty,
      reason: "insufficient_available",
      idempotencyKey,
    });
  }

  const updated = await HubInventory.findOneAndUpdate(
    {
      _id: hubInventory._id,
      availableQty: { $gte: qty },
      reservedQty: hubInventory.reservedQty,
    },
    { $inc: { reservedQty: qty, availableQty: -qty } },
    { new: true, session },
  );

  if (!updated) {
    return buildOperationResult({
      success: false,
      applied: false,
      action: "reserve_hub_stock",
      productId,
      variantId,
      hubId,
      quantity: qty,
      previousQty,
      newQty: previousQty,
      reason: "concurrent_reservation_failed",
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
    action: "reserve_hub_stock",
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

  const result = buildOperationResult({
    success: true,
    applied: true,
    action: "reserve_hub_stock",
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

  if (idempotencyKey) {
    await recordInventoryMutation({
      idempotencyKey,
      action: "reserve_hub_stock",
      productId,
      variantId,
      hubId,
      orderId,
      quantity: qty,
      applied: true,
      result,
      reason,
    });
  }

  return result;
};

/**
 * Commit seller inventory at procurement: stock -> committedStock.
 */
export const commitSellerInventory = async ({
  productId,
  variantId = null,
  quantity,
  session = null,
  reason = "commit_seller_inventory",
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
  const previousSnapshot = await import("./inventorySyncService.js").then((m) =>
    m.readProductStockSnapshot(productId, variantId, session),
  );

  try {
    validateSufficientSellerAvailable(product, variantId, qty);
  } catch (error) {
    logInventoryMovement({
      action: "commit_seller_inventory",
      orderId,
      productId,
      variantId,
      sellerId,
      quantity: qty,
      previousQty: previousSnapshot,
      newQty: previousSnapshot,
      reason: error.message,
      applied: false,
      idempotencyKey,
    });
    throw error;
  }

  await syncProductStock(productId, variantId, -qty, false, session);
  await syncProductStock(productId, variantId, qty, true, session);

  const newSnapshot = await import("./inventorySyncService.js").then((m) =>
    m.readProductStockSnapshot(productId, variantId, session),
  );

  logInventoryMovement({
    action: "commit_seller_inventory",
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

  const result = buildOperationResult({
    success: true,
    applied: true,
    action: "commit_seller_inventory",
    productId,
    variantId,
    sellerId,
    quantity: qty,
    previousQty: previousSnapshot,
    newQty: newSnapshot,
    reason,
    idempotencyKey,
  });

  if (idempotencyKey) {
    await recordInventoryMutation({
      idempotencyKey,
      action: "commit_seller_inventory",
      productId,
      variantId,
      sellerId,
      orderId,
      quantity: qty,
      applied: true,
      result,
      reason,
    });
  }

  return result;
};

/**
 * Receive non-order procurement at hub: increases availableQty.
 */
export const receiveInventoryAtHub = async (opts) => {
  const {
    productId,
    variantId = null,
    quantity,
    hubId = DEFAULT_HUB_ID,
    session = null,
    reason = "receive_inventory_at_hub",
    orderId = null,
    idempotencyKey = null,
  } = opts;

  return guardInventoryMutation({
    idempotencyKey,
    action: "receive_inventory_at_hub",
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

  updated.status = hubInventoryStatus(updated.availableQty, updated.reorderLevel);
  await updated.save({ session });

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
    action: "receive_inventory_at_hub",
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
    action: "receive_inventory_at_hub",
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
 * QA accepted for order-linked inward: increases reservedQty only.
 */
export const acceptQAInventory = async (opts) => {
  const {
    productId,
    quantity,
    hubId = DEFAULT_HUB_ID,
    session = null,
    reason = "accept_qa_inventory",
    orderId = null,
    idempotencyKey = null,
  } = opts;

  return guardInventoryMutation({
    idempotencyKey,
    action: "accept_qa_inventory",
    meta: { productId, hubId, orderId, quantity, reason },
    execute: async () => {
  const qty = assertPositiveQuantity(quantity);
  const hubInventory = await validateHubInventoryExists(productId, hubId, session);

  const previousQty = {
    availableQty: Math.max(0, Number(hubInventory.availableQty) || 0),
    reservedQty: Math.max(0, Number(hubInventory.reservedQty) || 0),
  };

  const updated = await HubInventory.findOneAndUpdate(
    { _id: hubInventory._id },
    { $inc: { reservedQty: qty } },
    { new: true, session },
  );

  updated.status = hubInventoryStatus(updated.availableQty, updated.reorderLevel);
  await updated.save({ session });

  const newQty = {
    availableQty: Math.max(0, Number(updated.availableQty) || 0),
    reservedQty: Math.max(0, Number(updated.reservedQty) || 0),
  };

  logInventoryMovement({
    action: "accept_qa_inventory",
    orderId,
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
    action: "accept_qa_inventory",
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
 * Initialize or add stock to hub row (admin hub inventory upsert).
 */
export const addHubAvailableStock = async (opts) => {
  const {
    productId,
    variantId = null,
    quantity,
    hubId = DEFAULT_HUB_ID,
    session = null,
    reason = "add_hub_available_stock",
    idempotencyKey = null,
    initialRowData = null,
  } = opts;

  return guardInventoryMutation({
    idempotencyKey,
    action: "add_hub_available_stock",
    meta: { productId, variantId, hubId, quantity, reason },
    execute: async () => {
  const qty = assertPositiveQuantity(quantity);
  let row = await HubInventory.findOne({ hubId, productId }).session(session);

  if (!row) {
    row = new HubInventory({
      hubId,
      productId,
      availableQty: Math.max(0, Number(initialRowData?.availableQty) || 0) + qty,
      reservedQty: 0,
      ...initialRowData,
    });
    await row.save({ session });
  } else {
    const previousQty = {
      availableQty: Math.max(0, Number(row.availableQty) || 0),
      reservedQty: Math.max(0, Number(row.reservedQty) || 0),
    };

    const updated = await HubInventory.findOneAndUpdate(
      { _id: row._id },
      { $inc: { availableQty: qty } },
      { new: true, session },
    );

    updated.status = hubInventoryStatus(updated.availableQty, updated.reorderLevel);
    await updated.save({ session });
    row = updated;

    try {
      await syncProductStock(productId, variantId, qty, false, session);
    } catch (error) {
      console.warn("[InventoryEngine] Product stock mirroring failed:", error.message);
    }

    const newQty = {
      availableQty: Math.max(0, Number(row.availableQty) || 0),
      reservedQty: Math.max(0, Number(row.reservedQty) || 0),
    };

    logInventoryMovement({
      action: "add_hub_available_stock",
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
      action: "add_hub_available_stock",
      productId,
      variantId,
      hubId,
      quantity: qty,
      previousQty,
      newQty,
      reason,
      idempotencyKey,
      hubInventory: row,
    });
  }

  try {
    await syncProductStock(productId, variantId, qty, false, session);
  } catch (error) {
    console.warn("[InventoryEngine] Product stock mirroring failed:", error.message);
  }

  const newQty = {
    availableQty: Math.max(0, Number(row.availableQty) || 0),
    reservedQty: Math.max(0, Number(row.reservedQty) || 0),
  };

  logInventoryMovement({
    action: "add_hub_available_stock",
    productId,
    variantId,
    hubId,
    quantity: qty,
    previousQty: { availableQty: 0, reservedQty: 0 },
    newQty,
    reason,
    idempotencyKey,
  });

  return buildOperationResult({
    success: true,
    applied: true,
    action: "add_hub_available_stock",
    productId,
    variantId,
    hubId,
    quantity: qty,
    previousQty: { availableQty: 0, reservedQty: 0 },
    newQty,
    reason,
    idempotencyKey,
    hubInventory: row,
  });
    },
  });
};
