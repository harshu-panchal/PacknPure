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
    Product.find({ masterProductId, ownerType: "seller", status: "active" })
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
    status: "active",
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

/**
 * Hub inventory list row — canonical stock view for admin hub screen.
 */
export const getHubInventoryRowView = async ({
  productId,
  hubAvailableQty,
  hubReservedQty,
  masterProduct = null,
  hubId = DEFAULT_HUB_ID,
}) => {
  const hubAvailable = hubAvailableQty ?? (await getHubAvailableQty(productId, hubId));
  const hubReserved = hubReservedQty ?? (await getHubReservedQty(productId, hubId));

  let sellerAvailable = 0;
  let sellerCommitted = 0;
  if (masterProduct) {
    const sellerProducts = await Product.find({
      masterProductId: String(masterProduct._id || productId),
      ownerType: "seller",
      status: "active",
    })
      .select("variants stock committedStock")
      .lean();
    for (const sp of sellerProducts) {
      sellerAvailable += getSellerAvailableQty(sp, null, masterProduct);
      if (Array.isArray(sp.variants) && sp.variants.length > 0) {
        sellerCommitted += sp.variants.reduce((s, v) => s + toQty(v.committedStock), 0);
      } else {
        sellerCommitted += toQty(sp.committedStock);
      }
    }
  }

  return {
    hubAvailableQty: hubAvailable,
    hubReservedQty: hubReserved,
    sellerAvailableQty: sellerAvailable,
    sellerCommittedQty: sellerCommitted,
    totalFulfillableQty: hubAvailable + sellerAvailable,
  };
};

/**
 * Batch stock context for product list endpoints (replaces inline aggregations).
 */
export const buildProductListStockContext = async (masterProductIds, hubId = DEFAULT_HUB_ID) => {
  const ids = [...new Set(masterProductIds.map((id) => String(id)).filter(Boolean))];
  const hubRows = await HubInventory.find({ productId: { $in: ids }, hubId }).lean();
  const hubMap = new Map();
  const hubReservedMap = new Map();
  for (const row of hubRows) {
    const key = String(row.productId);
    hubMap.set(key, toQty(row.availableQty));
    hubReservedMap.set(key, toQty(row.reservedQty));
  }

  const masterProducts = await Product.find({ _id: { $in: ids } }).select("variants").lean();
  const masterById = new Map(masterProducts.map((m) => [String(m._id), m]));

  const sellerProducts = await Product.find({
    masterProductId: { $in: ids },
    ownerType: "seller",
    status: "active",
  })
    .select("masterProductId variants stock committedStock purchasePrice")
    .lean();

  const sellerStockMap = new Map();
  const variantStockMap = new Map();

  for (const sp of sellerProducts) {
    const mid = String(sp.masterProductId);
    const master = masterById.get(mid);
    const view = getSellerProductStockView(sp);
    const prev = sellerStockMap.get(mid) || { stock: 0, committed: 0, cost: Infinity };
    sellerStockMap.set(mid, {
      stock: prev.stock + view.availableQty,
      committed: prev.committed + view.committedStock,
      cost: Math.min(prev.cost, Number(sp.purchasePrice) || Infinity),
    });

    if (Array.isArray(sp.variants) && sp.variants.length > 0) {
      for (const v of sp.variants) {
        const vName = normalizeVariantMatchKey(v.name);
        const variantAvailable = getSellerAvailableQty(sp, v._id, master);
        const key = `${mid}_${vName}`;
        variantStockMap.set(key, (variantStockMap.get(key) || 0) + variantAvailable);
      }
    } else {
      const available = getSellerAvailableQty(sp, null, master);
      const key = `${mid}_root`;
      variantStockMap.set(key, (variantStockMap.get(key) || 0) + available);
    }
  }

  return { hubMap, hubReservedMap, sellerStockMap, variantStockMap };
};

/**
 * Canonical seller variant available for hub inventory screen.
 */
export const getSellerVariantAvailableQty = (sellerListing, variantId, variantName, masterProduct) => {
  const sellerVar = (sellerListing?.variants || []).find(
    (sv) =>
      String(sv._id || "") === String(variantId || "") ||
      normalizeVariantMatchKey(sv.name) === normalizeVariantMatchKey(variantName || ""),
  );
  if (!sellerVar) return { availableQty: 0, committedStock: 0, grossStock: 0 };
  const grossStock = toQty(sellerVar.stock);
  const committedStock = toQty(sellerVar.committedStock);
  return {
    grossStock,
    committedStock,
    availableQty: Math.max(0, grossStock - committedStock),
  };
};

/**
 * Report row for inventory export.
 */
export const getInventoryReportRow = async (hubRow, product = null, hubId = DEFAULT_HUB_ID) => {
  const productId = String(hubRow.productId?._id || hubRow.productId);
  const stockView = product
    ? await getHubInventoryRowView({
        productId,
        hubAvailableQty: toQty(hubRow.availableQty),
        hubReservedQty: toQty(hubRow.reservedQty),
        masterProduct: product,
        hubId,
      })
    : {
        hubAvailableQty: toQty(hubRow.availableQty),
        hubReservedQty: toQty(hubRow.reservedQty),
        sellerAvailableQty: 0,
        sellerCommittedQty: 0,
        totalFulfillableQty: toQty(hubRow.availableQty),
      };

  return {
    availableQty: stockView.hubAvailableQty,
    reservedQty: stockView.hubReservedQty,
    sellerAvailableQty: stockView.sellerAvailableQty,
    sellerCommittedQty: stockView.sellerCommittedQty,
    totalFulfillableQty: stockView.totalFulfillableQty,
  };
};
