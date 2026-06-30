import HubInventory from "../models/hubInventory.js";
import Product from "../models/product.js";
import Order from "../models/order.js";

/**
 * Single Inventory Architecture
 * Centralized service for all inventory mutations.
 * 
 * Rules:
 * 1. Hub stock is physically deducted ONLY after successful delivery.
 * 2. Seller physical stock is deducted ONLY after successful pickup.
 * 3. Procurement goods received at hub DO NOT increase Hub available stock.
 * 4. Product.stock and Variant.stock remain mirrored fields.
 */

export const freezeHubInventory = async (productId, variantId, quantity, session = null) => {
  // Find and update only if availableQty - reservedQty >= quantity
  const hubInventory = await HubInventory.findOne({ productId, hubId: "MAIN_HUB" }).session(session);
  if (!hubInventory || (hubInventory.availableQty - hubInventory.reservedQty) < quantity) {
    return null; // Reservation failed due to insufficient stock
  }
  
  const updated = await HubInventory.findOneAndUpdate(
    { _id: hubInventory._id, reservedQty: hubInventory.reservedQty }, // Optimistic concurrency
    { $inc: { reservedQty: quantity } },
    { new: true, session }
  );

  if (updated) {
    try {
      // Mirror to Product.stock for backward compatibility
      if (variantId) {
        await Product.updateOne(
          { _id: productId },
          { $inc: { stock: -quantity, "variants.$[elem].stock": -quantity } },
          { arrayFilters: [{ "elem._id": variantId }], session }
        );
      } else {
        await Product.updateOne(
          { _id: productId },
          { $inc: { stock: -quantity } },
          { session }
        );
      }
    } catch (e) {
      console.warn("[InventoryLifecycle] Product stock mirroring failed:", e.message);
    }
  }
  return updated;
};

export const releaseHubReservation = async (productId, variantId, quantity, session = null) => {
  const updated = await HubInventory.findOneAndUpdate(
    { productId, hubId: "MAIN_HUB" },
    { $inc: { reservedQty: -quantity } },
    { new: true, session }
  );

  if (updated) {
    try {
      // Mirror to Product.stock for backward compatibility
      if (variantId) {
        await Product.updateOne(
          { _id: productId },
          { $inc: { stock: quantity, "variants.$[elem].stock": quantity } },
          { arrayFilters: [{ "elem._id": variantId }], session }
        );
      } else {
        await Product.updateOne(
          { _id: productId },
          { $inc: { stock: quantity } },
          { session }
        );
      }
    } catch (e) {
      console.warn("[InventoryLifecycle] Product stock mirroring failed:", e.message);
    }
  }
  return updated;
};

export const freezeSellerInventory = async (productId, variantId, quantity, session = null) => {
  const updateQuery = { $inc: { committedStock: quantity } };
  if (variantId) {
    updateQuery.$inc["variants.$[elem].committedStock"] = quantity;
    return await Product.findOneAndUpdate(
      { _id: productId },
      updateQuery,
      { arrayFilters: [{ "elem._id": variantId }], new: true, session }
    );
  } else {
    return await Product.findOneAndUpdate(
      { _id: productId },
      updateQuery,
      { new: true, session }
    );
  }
};

export const releaseSellerReservation = async (productId, variantId, quantity, session = null) => {
  const updateQuery = { $inc: { committedStock: -quantity } };
  if (variantId) {
    updateQuery.$inc["variants.$[elem].committedStock"] = -quantity;
    return await Product.findOneAndUpdate(
      { _id: productId },
      updateQuery,
      { arrayFilters: [{ "elem._id": variantId }], new: true, session }
    );
  } else {
    return await Product.findOneAndUpdate(
      { _id: productId },
      updateQuery,
      { new: true, session }
    );
  }
};

export const deductSellerInventoryAfterPickup = async (productId, variantId, quantity, session = null) => {
  // Reduces BOTH stock and committedStock (since it was previously committed)
  const updateQuery = { 
    $inc: { stock: -quantity, committedStock: -quantity } 
  };
  if (variantId) {
    updateQuery.$inc["variants.$[elem].stock"] = -quantity;
    updateQuery.$inc["variants.$[elem].committedStock"] = -quantity;
    return await Product.findOneAndUpdate(
      { _id: productId },
      updateQuery,
      { arrayFilters: [{ "elem._id": variantId }], new: true, session }
    );
  } else {
    return await Product.findOneAndUpdate(
      { _id: productId },
      updateQuery,
      { new: true, session }
    );
  }
};

export const completeHubDelivery = async (productId, quantity, session = null) => {
  // Deduct both available and reserved because it was reserved on order creation
  return await HubInventory.findOneAndUpdate(
    { productId, hubId: "MAIN_HUB" },
    { $inc: { availableQty: -quantity, reservedQty: -quantity } },
    { new: true, session }
  );
};

export const restoreHubInventory = async (productId, quantity, session = null) => {
  return await HubInventory.findOneAndUpdate(
    { productId, hubId: "MAIN_HUB" },
    { $inc: { availableQty: quantity } },
    { new: true, upsert: true, session }
  );
};

export const restoreSellerInventory = async (productId, variantId, quantity, session = null) => {
  const updateQuery = { $inc: { stock: quantity } };
  if (variantId) {
    updateQuery.$inc["variants.$[elem].stock"] = quantity;
    return await Product.findOneAndUpdate(
      { _id: productId },
      updateQuery,
      { arrayFilters: [{ "elem._id": variantId }], new: true, session }
    );
  } else {
    return await Product.findOneAndUpdate(
      { _id: productId },
      updateQuery,
      { new: true, session }
    );
  }
};

export const handleCustomerCancellation = async (productId, variantId, quantity, flowType, session = null) => {
  if (flowType === "before_pickup_hub") {
    await releaseHubReservation(productId, quantity, session);
  } else if (flowType === "before_pickup_seller") {
    await releaseSellerReservation(productId, variantId, quantity, session);
  } else if (flowType === "after_pickup") {
    // Goods already reached Hub/picked up, increase Hub Available and release reservation
    await restoreHubInventory(productId, quantity, session);
    // It depends on whether this is a hub reservation that we are also cancelling or what
    // This helper simplifies things but controllers might need granular calls instead.
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
