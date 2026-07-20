/**
 * @deprecated Use inventory/inventoryEngine.js.
 * Legacy hub inventory helpers — all mutations delegate to Inventory Engine.
 */
import {
  adjustHubAvailableStock,
  addHubAvailableStock,
  releaseHubReservation as engineReleaseHubReservation,
  reserveHubStock,
} from "./inventory/inventoryEngine.js";

export const getHubStock = async (productId, hubLocation) => {
  const HubInventory = (await import("../models/hubInventory.js")).default;
  const hubId = hubLocation || process.env.DEFAULT_HUB_ID || "MAIN_HUB";
  return HubInventory.findOne({ productId, hubId });
};

export const updateHubStock = async (productId, hubLocation, delta) => {
  const hubId = hubLocation || process.env.DEFAULT_HUB_ID || "MAIN_HUB";
  const result = await adjustHubAvailableStock({ productId, delta, hubId });
  return result.hubInventory;
};

export const reserveStock = async (productId, hubLocation, quantity) => {
  const hubId = hubLocation || process.env.DEFAULT_HUB_ID || "MAIN_HUB";
  const result = await reserveHubStock({ productId, quantity, hubId });
  if (!result.success) {
    const inventory = await getHubStock(productId, hubId);
    return { success: false, available: inventory?.availableQty || 0 };
  }
  return { success: true, inventory: result.hubInventory };
};

export const releaseStock = async (productId, hubLocation, quantity) => {
  const hubId = hubLocation || process.env.DEFAULT_HUB_ID || "MAIN_HUB";
  const result = await engineReleaseHubReservation({ productId, quantity, hubId });
  return result.hubInventory;
};
