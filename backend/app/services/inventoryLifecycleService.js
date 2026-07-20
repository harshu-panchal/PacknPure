/**
 * @deprecated Use inventory/inventoryEngine.js directly.
 * Kept for backward compatibility — all methods delegate to Inventory Engine.
 */
export {
  freezeHubInventory,
  deductHubAvailableInventory,
  restoreHubAvailableInventory,
  releaseHubReservation,
  freezeSellerInventory,
  releaseSellerReservation,
  deductSellerInventoryAfterPickup,
  completeHubDelivery,
  restoreHubInventory,
  restoreSellerInventory,
  handleCustomerCancellation,
  handleCustomerReturn,
  handleProcurementQA,
} from "./inventory/inventoryEngine.js";
