import Product from "../../models/product.js";

/**
 * Internal sync layer — only the Inventory Engine may call these helpers.
 * Keeps Product.stock / committedStock mirrored with hub and seller movements.
 */

export const syncProductStock = async (
  productId,
  variantId,
  deltaQty,
  isCommitted = false,
  session = null,
) => {
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
    await Product.updateOne({ _id: productId }, updateQuery, {
      arrayFilters: [{ "elem._id": variantId }],
      session,
    });
  } else {
    await Product.updateOne({ _id: productId }, updateQuery, { session });
  }
};

export const overwriteProductStock = async (
  productId,
  totalStock,
  variantsArray = null,
  session = null,
) => {
  const updateQuery = { $set: { stock: totalStock } };
  if (variantsArray) {
    updateQuery.$set.variants = variantsArray;
  }
  await Product.updateOne({ _id: productId }, updateQuery, { session });
};

export const readProductStockSnapshot = async (productId, variantId = null, session = null) => {
  const product = await Product.findById(productId).session(session).lean();
  if (!product) {
    return { stock: 0, committedStock: 0 };
  }

  if (variantId && Array.isArray(product.variants) && product.variants.length > 0) {
    const variant = product.variants.find((v) => String(v._id) === String(variantId));
    return {
      stock: Math.max(0, Number(variant?.stock) || 0),
      committedStock: Math.max(0, Number(variant?.committedStock) || 0),
    };
  }

  return {
    stock: Math.max(0, Number(product.stock) || 0),
    committedStock: Math.max(0, Number(product.committedStock) || 0),
  };
};
