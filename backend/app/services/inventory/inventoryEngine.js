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

// Backward-compatible aliases matching legacy inventoryLifecycleService names
export const freezeHubInventory = async (productId, variantId, quantity, session = null) => {
  const result = await reserveHubStock({ productId, variantId, quantity, session });
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
