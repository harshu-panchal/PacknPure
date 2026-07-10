import HubInventory from "../models/hubInventory.js";
import { syncProductStock } from "./inventorySyncService.js";

/**
 * Single Inventory Architecture
 * Centralized service for all inventory mutations.
 * 
 * Rules:
 * 1. Hub stock is physically deducted ONLY after successful delivery.
 * 2. Seller physical stock is deducted ONLY after successful pickup.
 * 3. Procurement goods received at hub DO NOT increase Hub available stock.
 * 4. Product.stock and Variant.stock remain mirrored fields managed by inventorySyncService.
 */

export const freezeHubInventory = async (productId, variantId, quantity, session = null) => {
  // Find and update only if availableQty >= quantity (availableQty is already the free physical stock)
  const hubInventory = await HubInventory.findOne({ productId, hubId: "MAIN_HUB" }).session(session);
  if (!hubInventory || hubInventory.availableQty < quantity) {
    return null; // Reservation failed due to insufficient stock
  }
  
  const updated = await HubInventory.findOneAndUpdate(
    { _id: hubInventory._id, reservedQty: hubInventory.reservedQty }, // Optimistic concurrency
    { $inc: { reservedQty: quantity, availableQty: -quantity } },
    { new: true, session }
  );

  if (updated) {
    try {
      // Mirror to Product.stock for backward compatibility
      await syncProductStock(productId, variantId, -quantity, false, session);
    } catch (e) {
      console.warn("[InventoryLifecycle] Product stock mirroring failed:", e.message);
    }
  }
  return updated;
};

export const releaseHubReservation = async (productId, variantId, quantity, session = null) => {
  const updated = await HubInventory.findOneAndUpdate(
    { productId, hubId: "MAIN_HUB" },
    { $inc: { reservedQty: -quantity, availableQty: quantity } },
    { new: true, session }
  );

  if (updated) {
    try {
      // Mirror to Product.stock for backward compatibility
      await syncProductStock(productId, variantId, quantity, false, session);
    } catch (e) {
      console.warn("[InventoryLifecycle] Product stock mirroring failed:", e.message);
    }
  }
  return updated;
};

export const freezeSellerInventory = async (productId, variantId, quantity, session = null) => {
  // Seller inventory is directly managed on the Product doc via syncProductStock
  // For freezing, we decrease stock and increase committedStock
  await syncProductStock(productId, variantId, -quantity, false, session);
  await syncProductStock(productId, variantId, quantity, true, session);
  return true;
};

export const releaseSellerReservation = async (productId, variantId, quantity, session = null) => {
  // Reverse of freeze
  await syncProductStock(productId, variantId, quantity, false, session);
  await syncProductStock(productId, variantId, -quantity, true, session);
  return true;
};

export const deductSellerInventoryAfterPickup = async (productId, variantId, quantity, session = null) => {
  // Reduces ONLY committedStock (since stock was previously deducted at reservation)
  await syncProductStock(productId, variantId, -quantity, true, session);
  return true;
};

export const completeHubDelivery = async (productId, quantity, session = null) => {
  // Deduct ONLY reserved because available was already deducted on order creation
  return await HubInventory.findOneAndUpdate(
    { productId, hubId: "MAIN_HUB" },
    { $inc: { reservedQty: -quantity } },
    { new: true, session }
  );
};

export const restoreHubInventory = async (productId, quantity, session = null) => {
  const updated = await HubInventory.findOneAndUpdate(
    { productId, hubId: "MAIN_HUB" },
    { $inc: { availableQty: quantity } },
    { new: true, upsert: true, session }
  );
  if (updated) {
    try {
      // Restore does not know variantId here, assume product level sync or handled upstream if variantId known
      // Note: If variantId is known, caller should use manual syncProductStock, 
      // but for generic restoreHubInventory we only have productId
      await syncProductStock(productId, null, quantity, false, session);
    } catch (e) {
      console.warn("[InventoryLifecycle] Product stock mirroring failed:", e.message);
    }
  }
  return updated;
};

export const restoreSellerInventory = async (productId, variantId, quantity, session = null) => {
  await syncProductStock(productId, variantId, quantity, false, session);
  return true;
};

export const handleCustomerCancellation = async (productId, variantId, quantity, flowType, session = null) => {
  if (flowType === "before_pickup_hub") {
    await releaseHubReservation(productId, variantId, quantity, session);
  } else if (flowType === "before_pickup_seller") {
    await releaseSellerReservation(productId, variantId, quantity, session);
  } else if (flowType === "after_pickup") {
    // Goods already reached Hub/picked up, increase Hub Available and release reservation
    await restoreHubInventory(productId, quantity, session);
  }
};

export const handleCustomerReturn = async (productId, variantId, qaPassedQty, qaFailedQty, session = null) => {
  if (qaPassedQty > 0) {
    await restoreHubInventory(productId, qaPassedQty, session);
  }
  if (qaFailedQty > 0) {
    await restoreSellerInventory(productId, variantId, qaFailedQty, session);
  }
};

export const handleProcurementQA = async (productId, variantId, acceptedQty, rejectedQty, session = null) => {
  // Procurement QA PASS: do NOTHING to HubInventory. Goods move to Order Reserved Procurement Bucket.
  // The caller will update the Order item (qaAcceptedQty).
  
  if (rejectedQty > 0) {
    // Goods return to seller, restore physical stock
    await restoreSellerInventory(productId, variantId, rejectedQty, session);
  }
};
