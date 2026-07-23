import {
  reserveHubStock,
  commitSellerInventory,
  receiveInventoryAtHub,
  acceptQAInventory,
  addHubAvailableStock,
} from "./inventoryReservationService.js";
import {
  releaseHubReservation as engineReleaseHubReservation,
  releaseSellerCommit,
  moveSellerCommitToTransit,
  deductHubInventory,
  completeHubDelivery as engineCompleteHubDelivery,
  restoreHubAvailableInventory,
  restoreSellerInventory as engineRestoreSellerInventory,
  rejectQAInventory,
  adjustHubAvailableStock,
  setAdminHubStock,
  adjustSellerStock,
  deductSellerInventory,
} from "./inventoryReleaseService.js";
import { validateInventory, InventoryError, DEFAULT_HUB_ID } from "./inventoryValidationService.js";
import { withInventorySession } from "./inventoryTransactionService.js";

/**
 * PacknPure Inventory Engine
 *
 * Single entry point for all inventory mutations.
 * Controllers, cron jobs, and procurement services must call these methods
 * instead of modifying stock fields directly.
 */

export {
  InventoryError,
  DEFAULT_HUB_ID,
  validateInventory,
  withInventorySession,
};

const isOptionsObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) && "productId" in value;

/**
 * Supports object options (preferred) and legacy positional (productId, variantId, quantity, session).
 */
export const releaseHubReservation = async (arg1, arg2, arg3, arg4) => {
  const opts = isOptionsObject(arg1)
    ? arg1
    : {
        productId: arg1,
        variantId: arg2 ?? null,
        quantity: arg3,
        session: arg4 ?? null,
      };
  return engineReleaseHubReservation(opts);
};

/**
 * Supports object options (preferred) and legacy positional (productId, quantity, session).
 * Legacy callers receive the hubInventory document; object callers receive the full result.
 */
export const completeHubDelivery = async (arg1, arg2, arg3) => {
  const opts = isOptionsObject(arg1)
    ? arg1
    : { productId: arg1, quantity: arg2, session: arg3 ?? null };
  const result = await engineCompleteHubDelivery(opts);
  return isOptionsObject(arg1) ? result : result.hubInventory ?? null;
};

/**
 * Supports object options (preferred) and legacy positional (productId, variantId, quantity, session).
 */
export const restoreSellerInventory = async (arg1, arg2, arg3, arg4) => {
  const opts = isOptionsObject(arg1)
    ? arg1
    : {
        productId: arg1,
        variantId: arg2 ?? null,
        quantity: arg3,
        session: arg4 ?? null,
      };
  return engineRestoreSellerInventory(opts);
};

export {
  reserveHubStock,
  commitSellerInventory,
  releaseSellerCommit,
  moveSellerCommitToTransit,
  receiveInventoryAtHub,
  acceptQAInventory,
  rejectQAInventory,
  deductHubInventory,
  restoreHubAvailableInventory,
  adjustHubAvailableStock,
  addHubAvailableStock,
  setAdminHubStock,
  adjustSellerStock,
  deductSellerInventory,
};

/**
 * Rollback order inventory based on fulfillment stage.
 * Architecture prepared for future automated rollback — callers receive rollbackToken metadata.
 */
export const rollbackOrderInventory = async ({
  productId,
  variantId = null,
  quantity,
  flowType,
  hubId = DEFAULT_HUB_ID,
  session = null,
  orderId = null,
  reason = "rollback_order_inventory",
  idempotencyKey = null,
}) => {
  if (flowType === "before_pickup_hub") {
    return engineReleaseHubReservation({
      productId,
      variantId,
      quantity,
      hubId,
      session,
      orderId,
      reason,
      idempotencyKey,
    });
  }

  if (flowType === "before_pickup_seller") {
    return releaseSellerCommit({
      productId,
      variantId,
      quantity,
      session,
      orderId,
      reason,
      idempotencyKey,
    });
  }

  if (flowType === "after_pickup") {
    return restoreHubAvailableInventory({
      productId,
      variantId,
      quantity,
      hubId,
      session,
      orderId,
      reason,
      idempotencyKey,
    });
  }

  return {
    success: false,
    applied: false,
    action: "rollback_order_inventory",
    reason: `unknown_flow_type:${flowType}`,
  };
};

/**
 * On delivery: deduct Hub Reserved (HR) for each order line and clear line reservations.
 * Safe to call from any DELIVERED path (OTP, workflow, admin). Idempotent via completeHubDelivery.
 */
export const finalizeHubInventoryOnDelivery = async (order) => {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return { applied: false, reason: "no_items" };
  }

  const hasReservedLines = order.items.some(
    (item) =>
      Math.max(0, Number(item.hubReservedQty || 0)) +
        Math.max(0, Number(item.qaAcceptedQty || 0)) >
      0,
  );

  if (!order.hubFlowEnabled && !hasReservedLines) {
    return { applied: false, reason: "not_hub_flow" };
  }

  const hubId = process.env.DEFAULT_HUB_ID || DEFAULT_HUB_ID || "MAIN_HUB";
  const HubInventory = (await import("../../models/hubInventory.js")).default;
  let orderDirty = false;
  let deductedLines = 0;

  for (const item of order.items) {
    const productId = String(item.product?._id || item.product || "");
    if (!productId) continue;

    const variantId = item.variantId || null;
    const reservedPortion =
      Math.max(0, Number(item.hubReservedQty || 0)) +
      Math.max(0, Number(item.qaAcceptedQty || 0));
    const qtyToDeduct =
      reservedPortion > 0
        ? reservedPortion
        : Math.max(
            0,
            Number(item.quantity || 0) - Number(item.deliveredQty || 0),
          );

    if (qtyToDeduct <= 0) continue;

    const deliveryResult = await completeHubDelivery({
      productId,
      variantId,
      quantity: qtyToDeduct,
      hubId,
      orderId: order._id,
      reason: "order_delivery_complete",
      idempotencyKey: `hub_delivery:${String(order._id)}:${productId}:${String(variantId || "root")}:${qtyToDeduct}`,
    });
    const hubStock = deliveryResult?.hubInventory;

    item.hubReservedQty = 0;
    item.qaAcceptedQty = 0;
    item.deliveredQty = Math.max(
      Number(item.deliveredQty || 0),
      Number(item.quantity || 0),
    );
    orderDirty = true;
    deductedLines += 1;

    if (hubStock) {
      let newStatus = "healthy";
      if (hubStock.availableQty <= 0) newStatus = "out_of_stock";
      else if (hubStock.availableQty <= (hubStock.reorderLevel || 10)) {
        newStatus = "low_stock";
      }

      if (hubStock.status !== newStatus) {
        await HubInventory.findByIdAndUpdate(hubStock._id, {
          $set: { status: newStatus },
        });
      }
      console.log(
        `[InventorySync] Deducted reserved ${qtyToDeduct} for ${productId}${variantId ? ` variant ${variantId}` : ""}. HR now ${hubStock.reservedQty}`,
      );
    }
  }

  if (orderDirty && typeof order.save === "function") {
    await order.save();
  }

  return { applied: deductedLines > 0, deductedLines };
};

// Backward-compatible aliases matching legacy inventoryLifecycleService names
export const freezeHubInventory = async (
  productId,
  variantId,
  quantity,
  session = null,
  idempotencyKey = null,
  orderId = null,
) => {
  const result = await reserveHubStock({
    productId,
    variantId,
    quantity,
    session,
    idempotencyKey,
    orderId,
  });
  return result.applied ? result.hubInventory : null;
};

export const freezeSellerInventory = async (
  productId,
  variantId,
  quantity,
  session = null,
  idempotencyKey = null,
) => {
  const result = await commitSellerInventory({
    productId,
    variantId,
    quantity,
    session,
    idempotencyKey,
  });
  return result.success;
};

export const releaseSellerReservation = async (productId, variantId, quantity, session = null) => {
  const result = await releaseSellerCommit({ productId, variantId, quantity, session });
  return result.success;
};

export const deductSellerInventoryAfterPickup = async (
  productId,
  variantId,
  quantity,
  session = null,
) => {
  const result = await moveSellerCommitToTransit({ productId, variantId, quantity, session });
  return result.success;
};

export const deductHubAvailableInventory = async (
  productId,
  variantId,
  quantity,
  session = null,
) => {
  const result = await deductHubInventory({ productId, variantId, quantity, session });
  return result.applied ? result.hubInventory : null;
};

export const restoreHubInventory = async (productId, quantity, session = null) => {
  const result = await restoreHubAvailableInventory({ productId, quantity, session });
  return result.hubInventory;
};

export const handleCustomerCancellation = async (
  productId,
  variantId,
  quantity,
  flowType,
  session = null,
) => {
  return rollbackOrderInventory({
    productId,
    variantId,
    quantity,
    flowType,
    session,
    reason: "customer_cancellation",
  });
};

export const handleCustomerReturn = async (
  productId,
  variantId,
  qaPassedQty,
  qaFailedQty,
  session = null,
) => {
  const results = [];
  if (qaPassedQty > 0) {
    results.push(
      await restoreHubAvailableInventory({
        productId,
        quantity: qaPassedQty,
        session,
        reason: "customer_return_qa_passed",
      }),
    );
  }
  if (qaFailedQty > 0) {
    results.push(
      await restoreSellerInventory({
        productId,
        variantId,
        quantity: qaFailedQty,
        session,
        reason: "customer_return_qa_failed",
      }),
    );
  }
  return results;
};

export const handleProcurementQA = async (
  productId,
  variantId,
  acceptedQty,
  rejectedQty,
  session = null,
) => {
  if (rejectedQty > 0) {
    return rejectQAInventory({
      productId,
      variantId,
      quantity: rejectedQty,
      session,
      reason: "procurement_qa_rejected",
    });
  }
  return { success: true, applied: false, action: "handle_procurement_qa" };
};
