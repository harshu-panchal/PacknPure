import HubInventory from "../models/hubInventory.js";
import Product from "../models/product.js";
import {
  effectiveProductStock,
  normalizeVariantMatchKey,
  totalVariantCommitted,
} from "../utils/productHelpers.js";

const toQty = (v) => Math.max(0, Number(v || 0));
const DEFAULT_HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";

/**
 * Canonical seller available = stock - committed (variant-aware).
 */
export const getSellerAvailableQty = (sellerProduct, masterVariantId = null, masterProduct = null) => {
  if (!sellerProduct) return 0;

  let masterVariantName = null;
  if (masterVariantId && Array.isArray(masterProduct?.variants)) {
    const masterVar = masterProduct.variants.find(
      (v) => String(v._id || v.id) === String(masterVariantId),
    );
    masterVariantName = masterVar?.name ? normalizeVariantMatchKey(masterVar.name) : null;
  }

  if (masterVariantName && Array.isArray(sellerProduct.variants)) {
    const sellerVar = sellerProduct.variants.find(
      (v) => normalizeVariantMatchKey(v.name) === masterVariantName,
    );
    if (sellerVar) {
      return Math.max(0, toQty(sellerVar.stock) - toQty(sellerVar.committedStock));
    }
  }

  if (Array.isArray(sellerProduct.variants) && sellerProduct.variants.length > 0) {
    return Math.max(
      0,
      effectiveProductStock(sellerProduct) - totalVariantCommitted(sellerProduct.variants),
    );
  }

  return Math.max(0, toQty(sellerProduct.stock) - toQty(sellerProduct.committedStock));
};

export const getHubAvailableQty = async (productId, hubId = DEFAULT_HUB_ID) => {
  const row = await HubInventory.findOne({ productId, hubId }).select("availableQty").lean();
  return toQty(row?.availableQty);
};

export const getHubReservedQty = async (productId, hubId = DEFAULT_HUB_ID) => {
  const row = await HubInventory.findOne({ productId, hubId }).select("reservedQty").lean();
  return toQty(row?.reservedQty);
};

/**
 * Customer-facing fulfillable qty: hub available + seller available (never committed).
 */
export const getCustomerFulfillableQty = async ({
  masterProductId,
  variantId = null,
  hubId = DEFAULT_HUB_ID,
}) => {
  const [hubAvailable, masterProduct, sellerProducts] = await Promise.all([
    getHubAvailableQty(masterProductId, hubId),
    Product.findById(masterProductId).select("variants").lean(),
    Product.find({ masterProductId, ownerType: "seller", isActive: true })
      .select("variants stock committedStock")
      .lean(),
  ]);

  let sellerAvailable = 0;
  for (const sellerProduct of sellerProducts) {
    sellerAvailable += getSellerAvailableQty(sellerProduct, variantId, masterProduct);
  }

  return {
    hubAvailableQty: hubAvailable,
    sellerAvailableQty: sellerAvailable,
    totalFulfillableQty: hubAvailable + sellerAvailable,
  };
};

/**
 * Admin master product view.
 */
export const getAdminProductStockView = async (masterProduct, hubId = DEFAULT_HUB_ID) => {
  const productId = String(masterProduct._id);
  const hubAvailable = await getHubAvailableQty(productId, hubId);
  const hubReserved = await getHubReservedQty(productId, hubId);

  const sellerProducts = await Product.find({
    masterProductId: productId,
    ownerType: "seller",
    isActive: true,
  })
    .select("variants stock committedStock")
    .lean();

  let sellerAvailable = 0;
  let sellerCommitted = 0;
  let sellerGross = 0;
  for (const sp of sellerProducts) {
    sellerAvailable += getSellerAvailableQty(sp, null, masterProduct);
    if (Array.isArray(sp.variants) && sp.variants.length > 0) {
      sellerGross += sp.variants.reduce((s, v) => s + toQty(v.stock), 0);
      sellerCommitted += sp.variants.reduce((s, v) => s + toQty(v.committedStock), 0);
    } else {
      sellerGross += toQty(sp.stock);
      sellerCommitted += toQty(sp.committedStock);
    }
  }

  return {
    hubAvailableQty: hubAvailable,
    hubReservedQty: hubReserved,
    sellerAvailableQty: sellerAvailable,
    sellerCommittedQty: sellerCommitted,
    sellerGrossQty: sellerGross,
    totalFulfillableQty: hubAvailable + sellerAvailable,
  };
};

/**
 * Seller listing view for one seller product.
 */
export const getSellerProductStockView = (sellerProduct) => {
  const variants = Array.isArray(sellerProduct?.variants) ? sellerProduct.variants : [];
  const grossStock = variants.length
    ? variants.reduce((s, v) => s + toQty(v.stock), 0)
    : toQty(sellerProduct?.stock);
  const committedStock = variants.length
    ? variants.reduce((s, v) => s + toQty(v.committedStock), 0)
    : toQty(sellerProduct?.committedStock);
  const availableQty = Math.max(0, grossStock - committedStock);

  return {
    grossStock,
    committedStock,
    availableQty,
    variants: variants.map((v) => ({
      name: v.name,
      grossStock: toQty(v.stock),
      committedStock: toQty(v.committedStock),
      availableQty: Math.max(0, toQty(v.stock) - toQty(v.committedStock)),
    })),
  };
};
