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
        const masterVar = master?.variants?.find(
          (mv) => normalizeVariantMatchKey(mv.name) === vName,
        );
        const variantAvailable = getSellerAvailableQty(sp, masterVar?._id, master);
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

/**
 * Per-seller rows for a master product (not merged).
 */
export const buildSellerSupplyBreakdown = (masterProduct, sellerProducts = []) => {
  const master = masterProduct;
  const masterVariants =
    Array.isArray(master?.variants) && master.variants.length > 0
      ? master.variants
      : [{ _id: null, name: "root", stock: master?.stock || 0 }];

  return sellerProducts.map((sp) => {
    const sellerDoc = sp.sellerId;
    const variantRows = masterVariants.map((mv) => {
      const availableQty = getSellerAvailableQty(sp, mv._id, master);
      return {
        variantId: mv._id ? String(mv._id) : null,
        name: mv.name || "Default",
        unit: mv.unit || sp.unit || "Pieces",
        availableQty,
        stock: availableQty,
      };
    });
    const availableQty = variantRows.reduce((s, row) => s + toQty(row.availableQty), 0);

    return {
      sellerId: sp.sellerId?._id || sp.sellerId,
      productId: sp._id,
      shopName: sellerDoc?.shopName || sellerDoc?.name || "Unknown Supplier",
      sellerName: sellerDoc?.name || "",
      sellerPhone: sellerDoc?.phone || "",
      sellerEmail: sellerDoc?.email || "",
      sellerVerified: Boolean(sellerDoc?.isVerified),
      productName: sp.name,
      status: sp.status,
      availableQty,
      stock: availableQty,
      purchasePrice: Number(sp.purchasePrice) || 0,
      variants: variantRows,
      needsAdminReview: Boolean(sp.adminReview?.pending),
      updatedAt: sp.updatedAt,
    };
  });
};

/**
 * Canonical stock context for master catalog products (list + detail).
 */
export const buildCanonicalStockContext = async (masterProductIds, hubId = DEFAULT_HUB_ID) => {
  const base = await buildProductListStockContext(masterProductIds, hubId);
  const ids = [...new Set(masterProductIds.map((id) => String(id)).filter(Boolean))];
  if (!ids.length) {
    return { ...base, productViews: new Map() };
  }

  const masterProducts = await Product.find({ _id: { $in: ids } })
    .select("_id variants stock unit")
    .lean();

  const sellerProducts = await Product.find({
    masterProductId: { $in: ids },
    ownerType: "seller",
    status: "active",
  })
    .select(
      "masterProductId sellerId name status unit variants stock committedStock purchasePrice adminReview updatedAt",
    )
    .populate("sellerId", "shopName name phone email isVerified")
    .lean();

  const sellersByMaster = new Map();
  for (const sp of sellerProducts) {
    const mid = String(sp.masterProductId);
    if (!sellersByMaster.has(mid)) sellersByMaster.set(mid, []);
    sellersByMaster.get(mid).push(sp);
  }

  const productViews = new Map();

  for (const master of masterProducts) {
    const mid = String(master._id);
    const hubRowAvailable = base.hubMap.get(mid) ?? 0;
    const hubReservedQty = base.hubReservedMap.get(mid) ?? 0;
    const sellers = sellersByMaster.get(mid) || [];
    const sellerAgg = base.sellerStockMap.get(mid) || { stock: 0, committed: 0, cost: Infinity };

    const masterVariants =
      Array.isArray(master.variants) && master.variants.length > 0
        ? master.variants
        : [{ _id: null, name: "root", stock: master.stock || 0, unit: master.unit }];

    const variantViews = [];
    const productSellerBreakdownMap = new Map();

    for (const mv of masterVariants) {
      const variantKey = normalizeVariantMatchKey(mv.name);
      const hubPhysical = toQty(mv.stock);
      const availableQtyHub = hubPhysical;

      let availableQtySeller = 0;
      const sellerSupplyBreakdown = [];

      for (const sp of sellers) {
        const sellerAvailable = getSellerAvailableQty(sp, mv._id, master);
        if (sellerAvailable <= 0) continue;
        availableQtySeller += sellerAvailable;
        const sellerId = String(sp.sellerId?._id || sp.sellerId);
        sellerSupplyBreakdown.push({
          sellerId: sp.sellerId?._id || sp.sellerId,
          productId: sp._id,
          shopName: sp.sellerId?.shopName || sp.sellerId?.name || "Unknown Supplier",
          availableQty: sellerAvailable,
        });

        const prev = productSellerBreakdownMap.get(sellerId) || {
          sellerId: sp.sellerId?._id || sp.sellerId,
          productId: sp._id,
          shopName: sp.sellerId?.shopName || sp.sellerId?.name || "Unknown Supplier",
          availableQty: 0,
        };
        prev.availableQty += sellerAvailable;
        productSellerBreakdownMap.set(sellerId, prev);
      }

      const totalAvailableQty = availableQtyHub + availableQtySeller;
      variantViews.push({
        variantId: mv._id,
        variantKey,
        stock: hubPhysical,
        availableQtyHub,
        availableQtySeller,
        totalAvailableQty,
        totalFulfillmentQty: totalAvailableQty,
        sellerSupplyBreakdown,
      });
    }

    const hasVariants = masterVariants.length > 0 && masterVariants[0].name !== "root";
    const stock = hasVariants
      ? variantViews.reduce((s, v) => s + v.stock, 0)
      : hubRowAvailable;
    const availableQtyHub = hasVariants
      ? variantViews.reduce((s, v) => s + v.availableQtyHub, 0)
      : hubRowAvailable;
    const availableQtySeller = variantViews.reduce((s, v) => s + v.availableQtySeller, 0);
    const totalAvailableQty = availableQtyHub + availableQtySeller;

    productViews.set(mid, {
      stock,
      availableQtyHub,
      availableQtySeller,
      committedQtySeller: sellerAgg.committed,
      totalAvailableQty,
      totalFulfillmentQty: totalAvailableQty,
      hubReservedQty,
      variants: variantViews,
      variantByKey: new Map(variantViews.map((v) => [v.variantKey, v])),
      sellerSupplyBreakdown: [...productSellerBreakdownMap.values()],
      sellerProducts: sellers,
      vendorMinSupplyPrice: Number.isFinite(sellerAgg.cost) ? sellerAgg.cost : 0,
    });
  }

  return { ...base, productViews };
};

/** Apply canonical variant stock fields (hub physical in stock). */
export const mapVariantWithCanonicalStock = (variantRow, canonicalVariantView) => {
  const row = typeof variantRow?.toObject === "function" ? variantRow.toObject() : { ...variantRow };
  if (!canonicalVariantView) {
    const hubPhysical = toQty(row.stock);
    return {
      ...row,
      stock: hubPhysical,
      availableQtyHub: hubPhysical,
      availableQtySeller: 0,
      totalAvailableQty: hubPhysical,
      totalFulfillmentQty: hubPhysical,
      sellerSupplyBreakdown: [],
    };
  }
  return {
    ...row,
    stock: canonicalVariantView.stock,
    availableQtyHub: canonicalVariantView.availableQtyHub,
    availableQtySeller: canonicalVariantView.availableQtySeller,
    totalAvailableQty: canonicalVariantView.totalAvailableQty,
    totalFulfillmentQty: canonicalVariantView.totalFulfillmentQty,
    sellerSupplyBreakdown: canonicalVariantView.sellerSupplyBreakdown || [],
  };
};

/** Master catalog product — identical stock contract for admin/customer/POS. */
export const applyCanonicalStockToMasterProduct = (product, canonicalView, extra = {}) => {
  if (!product || !canonicalView) return product;

  const variants = (product.variants || []).map((v) => {
    const vKey = normalizeVariantMatchKey(v.name);
    const vv = canonicalView.variantByKey.get(vKey);
    return mapVariantWithCanonicalStock(v, vv);
  });

  return {
    ...product,
    ...extra,
    stock: canonicalView.stock,
    catalogStock: canonicalView.availableQtyHub,
    availableQtyHub: canonicalView.availableQtyHub,
    reservedQtyHub: canonicalView.hubReservedQty,
    availableQtySeller: canonicalView.availableQtySeller,
    committedQtySeller: canonicalView.committedQtySeller,
    totalAvailableQty: canonicalView.totalAvailableQty,
    totalFulfillmentQty: canonicalView.totalFulfillmentQty,
    sellerSupplyBreakdown: extra.sellerSupplyBreakdown ?? canonicalView.sellerSupplyBreakdown,
    variants,
  };
};

/** Seller listing — same field names; variant.stock = seller gross physical. */
export const applyCanonicalStockToSellerListing = (product, masterCanonicalView) => {
  const stockView = getSellerProductStockView(product);
  const hubQty = masterCanonicalView?.availableQtyHub ?? 0;
  const hubReserved = masterCanonicalView?.hubReservedQty ?? 0;

  const variants = (product.variants || []).map((v, idx) => {
    const row = typeof v?.toObject === "function" ? v.toObject() : { ...v };
    const sv = stockView.variants[idx] || {
      grossStock: toQty(row.stock),
      committedStock: toQty(row.committedStock),
      availableQty: Math.max(0, toQty(row.stock) - toQty(row.committedStock)),
    };
    const masterKey = normalizeVariantMatchKey(row.name);
    const masterVariant = masterCanonicalView?.variantByKey?.get(masterKey);

    return {
      ...row,
      stock: sv.grossStock,
      committedStock: sv.committedStock,
      availableQtySeller: sv.availableQty,
      availableQtyHub: masterVariant?.availableQtyHub ?? 0,
      totalAvailableQty: sv.availableQty,
      totalFulfillmentQty: sv.availableQty,
    };
  });

  return {
    ...product,
    stock: stockView.grossStock,
    catalogStock: stockView.grossStock,
    committedStock: stockView.committedStock,
    availableQtySeller: stockView.availableQty,
    availableQtyHub: hubQty,
    reservedQtyHub: hubReserved,
    totalAvailableQty: stockView.availableQty,
    totalFulfillmentQty: stockView.availableQty,
    variants,
  };
};
