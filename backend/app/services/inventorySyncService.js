import Product from "../models/product.js";

/**
 * InventorySyncService
 * The ONLY service allowed to modify Product.stock and Product.variants[].stock.
 * Used to keep the Product read-model in sync with HubInventory and Seller inventory mutations.
 */

export const syncProductStock = async (productId, variantId, deltaQty, isCommitted = false, session = null) => {
  if (deltaQty === 0) return;
  
  const updateQuery = isCommitted 
    ? { $inc: { committedStock: deltaQty } }
    : { $inc: { stock: deltaQty } };

  if (variantId) {
    if (isCommitted) {
      updateQuery.$inc["variants.$[elem].committedStock"] = deltaQty;
    } else {
      updateQuery.$inc["variants.$[elem].stock"] = deltaQty;
    }
    await Product.updateOne(
      { _id: productId },
      updateQuery,
      { arrayFilters: [{ "elem._id": variantId }], session }
    );
  } else {
    await Product.updateOne({ _id: productId }, updateQuery, { session });
  }
};

export const overwriteProductStock = async (productId, totalStock, variantsArray = null, session = null) => {
  const updateQuery = { $set: { stock: totalStock } };
  if (variantsArray) {
    updateQuery.$set.variants = variantsArray;
  }
  await Product.updateOne({ _id: productId }, updateQuery, { session });
};
