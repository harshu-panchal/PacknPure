import mongoose from "mongoose";

/** Auto-recalculation engine for GST fields */
export const calculateGstCostings = (doc, ownerType) => {
  if (!doc) return;
  const isSeller = String(ownerType || doc.ownerType) === "seller";
  
  // Root level GST calculations removed

  if (Array.isArray(doc.variants)) {
    doc.variants.forEach(v => {
      const vBaseCost = Number(v.purchasePrice) || 0;
      const vGstRate = v.gstEnabled ? (Number(v.gstRate) || 0) : 0;
      const vGstAmount = Number((vBaseCost * (vGstRate / 100)).toFixed(2));
      
      v.gstAmount = vGstAmount;
      if (isSeller) {
        v.finalSupplyPrice = vBaseCost + vGstAmount;
        
        // Admin Extra GST on top of Seller's Final Supply Price
        const extraGstRate = v.adminExtraGstEnabled ? (Number(v.adminExtraGstRate) || 0) : 0;
        const extraGstAmount = Number((v.finalSupplyPrice * (extraGstRate / 100)).toFixed(2));
        
        v.finalVendorCost = v.finalSupplyPrice + extraGstAmount;
      } else {
        v.finalVendorCost = vBaseCost + vGstAmount;
        v.finalSupplyPrice = 0;
      }
    });
  }
};

/** Supported sell units (matches admin/seller UI). */
export const PRODUCT_UNITS = [
  "Pieces",
  "kg",
  "g",
  "L",
  "ml",
  "Pack",
  "Box",
  "Jar",
  "Bundle",
];

export function normalizeUnit(unit, fallback = "Pieces") {
  const u = String(unit || "").trim();
  return PRODUCT_UNITS.includes(u) ? u : fallback;
}

export function normalizeVariantMatchKey(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\b(kilograms?|kgs?)\b/g, "kg")
    .replace(/\b(grams?|gms?)\b/g, "g")
    .replace(/\b(litres?|liters?|ltrs?)\b/g, "l")
    .replace(/\b(millilitres?|milliliters?|mls?)\b/g, "ml")
    .replace(/\b(pieces?|pcs?)\b/g, "pcs")
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeProductName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Canonical variant identity for duplicate detection.
 * Same product name + same signature = same catalog item.
 * Different variant rows (name + unit) = allowed as a separate product.
 */
export function buildVariantSignature(variants = [], rootUnit = "Pieces") {
  const unit = normalizeUnit(rootUnit);
  const rows =
    Array.isArray(variants) && variants.length > 0
      ? variants
      : [{ name: "default", unit }];

  return rows
    .map((v) => {
      const n = String(v?.name || "default").trim().toLowerCase();
      const u = normalizeUnit(v?.unit, unit).toLowerCase();
      return `${n}|${u}`;
    })
    .sort()
    .join(";");
}

export function variantsShareSignature(leftVariants, leftUnit, rightVariants, rightUnit) {
  return (
    buildVariantSignature(leftVariants, leftUnit) ===
    buildVariantSignature(rightVariants, rightUnit)
  );
}

export function parseVariantsField(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Admin master catalog: customer-facing pricing on variants. */
export const PRICING_MODE_CUSTOMER = "customer";
/** Seller supply listing: procurement price only. */
export const PRICING_MODE_SUPPLY = "supply";

/**
 * Resolve vendor supply price from API payload (seller).
 * Ignores salePrice — that field is customer pricing on admin masters.
 */
export function resolveSupplyPriceFromInput(input = {}) {
  for (const key of ["supplyPrice", "purchasePrice", "price"]) {
    const n = Number(input[key]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export function resolveSupplyPriceFromVariantRow(variant = {}, fallback = 0) {
  for (const key of ["supplyPrice", "purchasePrice", "price"]) {
    const n = Number(variant[key]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const fb = Number(fallback);
  return Number.isFinite(fb) && fb > 0 ? fb : 0;
}

/** Mirror supply price on all stored price fields for seller listings. */
export function applySellerSupplyToProductData(productData, supplyPrice) {
  // Root pricing is deprecated, this is now a no-op or we can rely on variants updating
  return productData;
}

export function normalizeSellerProductBody(productData, reqBody = {}) {
  const supply = resolveSupplyPriceFromInput({ ...reqBody, ...productData });
  if (supply > 0) applySellerSupplyToProductData(productData, supply);
  return productData;
}

/**
 * Admin master catalog variants: price = MRP, salePrice = customer price, purchasePrice = hub cost.
 */
export function normalizeAdminVariants(variants, opts = {}) {
  const {
    defaultUnit = "Pieces",
    basePrice = 0,
    baseSalePrice = 0,
    basePurchasePrice = 0,
  } = opts;

  if (!Array.isArray(variants) || !variants.length) return [];

  return variants.map((v, index) => {
    const name = String(v?.name || "").trim() || `Variant ${index + 1}`;
    const rawMrp = Number(v?.price);
    const rawSale = Number(v?.salePrice);
    const purchase = Number(v?.purchasePrice);
    const stock = Number(v?.stock);

    const salePrice = Number.isFinite(rawSale) && rawSale >= 0
      ? rawSale
      : Number.isFinite(rawMrp) && rawMrp >= 0
        ? rawMrp
        : baseSalePrice;

    const price = Number.isFinite(rawMrp) && rawMrp >= 0
      ? Math.max(rawMrp, salePrice)
      : salePrice > 0
        ? salePrice
        : basePrice;

    const purchasePrice = Number.isFinite(purchase) && purchase >= 0
      ? purchase
      : Number.isFinite(basePurchasePrice) && basePurchasePrice >= 0
        ? basePurchasePrice
        : 0;

    const variantId = v?._id || v?.id;
    const { gstEnabled, gstRate } = normalizeVariantGstFields(v);
    
    // Pass through admin extra GST fields
    const adminExtraGstEnabled = v?.adminExtraGstEnabled === true || v?.adminExtraGstEnabled === "true";
    const adminExtraGstRate = adminExtraGstEnabled ? (Number(v?.adminExtraGstRate) || 0) : 0;

    const row = {
      name,
      unit: normalizeUnit(v?.unit, defaultUnit),
      price,
      salePrice,
      purchasePrice,
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
      gstEnabled,
      gstRate,
      adminExtraGstEnabled,
      adminExtraGstRate,
    };
    if (variantId && mongoose.Types.ObjectId.isValid(String(variantId))) {
      row._id = variantId;
    }
    return row;
  });
}

/** @deprecated alias — admin catalog variants */
export const normalizeVariants = normalizeAdminVariants;

/** Seller supply variants: single supply price mirrored on price / salePrice / purchasePrice. */
export function normalizeSellerVariants(variants, opts = {}) {
  const { defaultUnit = "Pieces", baseSupply = 0 } = opts;
  if (!Array.isArray(variants) || !variants.length) return [];

  return variants.map((v, index) => {
    const name = String(v?.name || "").trim() || `Variant ${index + 1}`;
    const supply = resolveSupplyPriceFromVariantRow(v, baseSupply);
    const stock = Number(v?.stock);
    const variantId = v?._id || v?.id;
    const { gstEnabled, gstRate } = normalizeVariantGstFields(v);
    
    // Pass through admin extra GST fields
    const adminExtraGstEnabled = v?.adminExtraGstEnabled === true || v?.adminExtraGstEnabled === "true";
    const adminExtraGstRate = adminExtraGstEnabled ? (Number(v?.adminExtraGstRate) || 0) : 0;

    const row = {
      name,
      unit: normalizeUnit(v?.unit, defaultUnit),
      price: 0,
      salePrice: 0,
      purchasePrice: supply,
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
      gstEnabled,
      gstRate,
      adminExtraGstEnabled,
      adminExtraGstRate,
    };
    if (variantId && mongoose.Types.ObjectId.isValid(String(variantId))) {
      row._id = variantId;
    }
    return row;
  });
}

export function normalizeVariantGstFields(variant = {}) {
  const gstEnabled =
    variant.gstEnabled === true ||
    variant.gstEnabled === "true" ||
    variant.gstEnabled === 1;
  const gstRate = gstEnabled
    ? Math.max(0, Number(variant.gstRate) || 0)
    : 0;
  return { gstEnabled, gstRate };
}

/** Copy primary GST to product root for cart/checkout compatibility. */
export function syncProductGstFromVariants(productData) {
  const variants = Array.isArray(productData?.variants) ? productData.variants : [];
  const withGst = variants.find(
    (v) => v.gstEnabled && Number(v.gstRate) > 0,
  );
  productData.gstRate = withGst ? Number(withGst.gstRate) : 0;
  return productData;
}

export function validateAdminCatalogPricing(productData) {
  const sell = effectiveSellingPrice(productData);
  if (sell <= 0) {
    return { ok: false, message: "Customer sale price (salePrice) must be greater than 0" };
  }
  const firstVariant = productData?.variants?.[0];
  const mrp = Number(firstVariant?.price) || Number(productData?.price) || 0;
  if (mrp <= 0) {
    return { ok: false, message: "MRP (price) must be greater than 0" };
  }
  if (mrp < sell) {
    return { ok: false, message: "MRP (price) cannot be less than customer sale price" };
  }
  return { ok: true };
}

export function validateSellerSupplyPricing(productData) {
  const variants = Array.isArray(productData?.variants) ? productData.variants : [];
  if (variants.length > 0) {
    const offered = variants.filter((v) => resolveSupplyPriceFromVariantRow(v) > 0);
    if (!offered.length) {
      return {
        ok: false,
        message: "Supply price must be greater than 0 for at least one variant",
      };
    }
    const invalidOffered = offered.some((v) => {
      const stock = Number(v?.stock);
      return !Number.isFinite(stock) || stock < 0;
    });
    if (invalidOffered) {
      return { ok: false, message: "Stock must be zero or greater for listed variants" };
    }
    return { ok: true };
  }

  const supply = resolveSupplyPriceFromInput(productData);
  if (supply <= 0) {
    return { ok: false, message: "Supply price must be greater than 0" };
  }
  return { ok: true };
}

export function validateSellerSupplyPricingAgainstMaster(sellerData, masterProduct) {
  if (!masterProduct) return { ok: true };

  const sellerVariants = Array.isArray(sellerData.variants) ? sellerData.variants : [];
  const masterVariants = Array.isArray(masterProduct.variants) ? masterProduct.variants : [];

  if (sellerVariants.length > 0 && masterVariants.length > 0) {
      for (const sv of sellerVariants) {
          const supplyPrice = Number(sv.purchasePrice) || Number(sellerData.purchasePrice) || 0;
          if (supplyPrice <= 0) continue; // Unlisted

          // Using finalSupplyPrice calculated by calculateGstCostings, or manual fallback
          const finalSupply = sv.finalSupplyPrice || (supplyPrice + (supplyPrice * ((sv.gstEnabled ? (Number(sv.gstRate) || 0) : 0) / 100)));
          
          const svKey = normalizeVariantMatchKey(sv.name);
          const mv = masterVariants.find((m) => normalizeVariantMatchKey(m.name) === svKey);
          if (mv) {
              const customerPrice = Number(mv.salePrice || mv.price || 0);
              if (customerPrice > 0 && finalSupply > customerPrice) {
                  return { ok: false, message: `Supply price for "${sv.name}" (₹${finalSupply.toFixed(2)} incl. GST) cannot exceed the Hub's selling price (₹${customerPrice}).` };
              }
          }
      }
  } else {
      const supplyPrice = resolveSupplyPriceFromInput(sellerData);
      if (supplyPrice > 0) {
          const finalSupply = sellerData.finalSupplyPrice || (supplyPrice + (supplyPrice * ((sellerData.gstEnabled ? (Number(sellerData.gstRate) || 0) : 0) / 100)));
          const firstAdmin = firstVariantPricing(masterProduct);
          const customerPrice = Number(firstAdmin.salePrice || firstAdmin.price || 0);
          if (customerPrice > 0 && finalSupply > customerPrice) {
              return { ok: false, message: `Supply price (₹${finalSupply.toFixed(2)} incl. GST) cannot exceed the Hub's selling price (₹${customerPrice}).` };
          }
      }
  }

  return { ok: true };
}

export function mapSellerVariantsForResponse(variants = []) {
  return (variants || []).map((v) => {
    const row = typeof v?.toObject === "function" ? v.toObject() : { ...v };
    const supplyPrice = resolveSupplyPriceFromVariantRow(row);
    return {
      ...row,
      unit: normalizeUnit(row.unit),
      supplyPrice,
      price: supplyPrice,
      salePrice: supplyPrice,
      purchasePrice: supplyPrice,
      stock: Math.max(0, Number(row.stock) || 0),
    };
  });
}

/** Variant rows for stock picker UI / API errors. */
export function listVariantsForStockPicker(product) {
  const variants = product?.variants || [];
  return variants.map((v, index) => {
    const plain = v?.toObject ? v.toObject() : v;
    return {
      variantId: plain?._id ? String(plain._id) : null,
      index,
      name: String(plain?.name || "").trim() || `Variant ${index + 1}`,
      stock: Math.max(0, Number(plain?.stock) || 0),
      unit: plain?.unit || product?.unit || "Pieces",
    };
  });
}

/**
 * Resolve which variant row to update (variantId preferred, then index, then name).
 * Returns -1 if not found; -2 if product has variants but no selector was given.
 */
export function resolveVariantIndex(product, opts = {}) {
  const { variantId, variantIndex, variantName } = opts;
  const variants = product?.variants || [];
  if (!variants.length) return variants.length === 0 ? -1 : -2;

  const hasSelector =
    (variantId !== undefined && variantId !== null && String(variantId).trim() !== "") ||
    (variantIndex !== undefined && variantIndex !== null && variantIndex !== "") ||
    (variantName !== undefined && variantName !== null && String(variantName).trim() !== "");

  if (!hasSelector) return -2;

  if (variantId !== undefined && variantId !== null && String(variantId).trim() !== "") {
    const idStr = String(variantId).trim();
    const byId = variants.findIndex((v) => String(v?._id) === idStr);
    if (byId >= 0) return byId;
  }

  if (variantIndex !== undefined && variantIndex !== null && variantIndex !== "") {
    const idx = Number(variantIndex);
    if (Number.isInteger(idx) && idx >= 0 && idx < variants.length) return idx;
  }

  if (variantName !== undefined && variantName !== null && String(variantName).trim() !== "") {
    const target = normalizeVariantMatchKey(variantName);
    const byName = variants.findIndex((v) => normalizeVariantMatchKey(v?.name) === target);
    if (byName >= 0) return byName;
  }

  return -1;
}

/** Clone variant subdocs and set stock on one row; returns plain variant objects. */
export function setVariantStockAtIndex(variants, index, stock) {
  const qty = Math.max(0, Number(stock) || 0);
  return (variants || []).map((v, i) => {
    const plain = v?.toObject ? v.toObject() : { ...v };
    return {
      ...plain,
      stock: i === index ? qty : Math.max(0, Number(plain.stock) || 0),
    };
  });
}

export function variantStockRequiresSelection(product) {
  return Array.isArray(product?.variants) && product.variants.length > 0;
}

/** Customer-facing sell amount (prefers salePrice over list/MRP). */
export function effectiveSellingPrice(productData) {
  const first = productData?.variants?.[0];
  if (!first) return 0;
  const vSale = Number(first.salePrice);
  const vMrp = Number(first.price);
  if (Number.isFinite(vSale) && vSale > 0) return vSale;
  if (Number.isFinite(vMrp) && vMrp > 0) return vMrp;
  return 0;
}

export function totalVariantStock(variants) {
  if (!Array.isArray(variants) || !variants.length) return 0;
  return variants.reduce((sum, v) => sum + (Number(v?.stock) || 0), 0);
}

export function totalVariantCommitted(variants) {
  if (!Array.isArray(variants) || !variants.length) return 0;
  return variants.reduce((sum, v) => sum + (Number(v?.committedStock) || 0), 0);
}

/** Sellable quantity: sum of variant stocks, else root product stock. Minus commitments. */
export function effectiveProductStock(product) {
  if (Array.isArray(product?.variants) && product.variants.length > 0) {
    const variantStockSum = totalVariantStock(product.variants);
    if (variantStockSum > 0) {
      return Math.max(0, variantStockSum);
    }
  }
  return Math.max(0, Number(product?.stock) || 0);
}

/** Calculate customer cart cap: hub variant stock + gross seller stock (matches admin/seller UIs). */
export async function calculateTotalAvailableStock(masterProduct, variantId = null) {
  if (!masterProduct) return 0;
  
  const Product = (await import("../models/product.js")).default;
  const HubInventory = (await import("../models/hubInventory.js")).default;

  // 1. Hub Available Qty (availableQty - reservedQty)
  let hubAvailableQty = 0;
  let masterVar = null;
  const hubId = process.env.DEFAULT_HUB_ID || "MAIN_HUB";
  const hubRow = await HubInventory.findOne({ hubId, productId: masterProduct._id }).lean();
  const hubTotalQty = hubRow ? Math.max(0, Number(hubRow.availableQty || 0)) : 0;

  if (variantId && Array.isArray(masterProduct.variants)) {
     masterVar = masterProduct.variants.find(v => String(v._id) === String(variantId) || String(v.id) === String(variantId));
     hubAvailableQty = Math.min(hubTotalQty, Math.max(0, Number(masterVar?.stock) || 0));
  } else {
     const maxVarStock = Array.isArray(masterProduct.variants) ? masterProduct.variants.reduce((acc, v) => acc + Math.max(0, Number(v.stock) || 0), 0) : 0;
     hubAvailableQty = Math.min(hubTotalQty, maxVarStock);
  }

  // 2. Sum(SellerAvailableQty) (stock)
  let sumSellerQty = 0;
  if (masterProduct.ownerType === "admin") {
    try {
       const sellerDocs = await Product.find({
         masterProductId: masterProduct._id,
         ownerType: "seller",
         status: "active"
       }).select("stock committedStock variants").lean();
       
       for (const sDoc of sellerDocs) {
         if (masterVar) {
            const masterKey = normalizeVariantMatchKey(masterVar.name);
            const sVar = Array.isArray(sDoc.variants)
              ? sDoc.variants.find(
                  (v) => normalizeVariantMatchKey(v.name) === masterKey,
                )
              : null;
            if (sVar) {
               sumSellerQty += Math.max(0, Number(sVar.stock) || 0);
            } else if (!Array.isArray(sDoc.variants) || sDoc.variants.length === 0) {
               if (Array.isArray(masterProduct.variants) && masterProduct.variants.length === 1) {
                 // Seller has no variants but master exactly 1, assume seller's root stock applies
                 sumSellerQty += Math.max(0, Number(sDoc.stock) || 0);
               }
            }
         } else {
            const vSum = Array.isArray(sDoc.variants)
              ? sDoc.variants.reduce(
                  (acc, v) => acc + Math.max(0, Number(v.stock) || 0),
                  0,
                )
              : 0;
            sumSellerQty += vSum;
         }
       }
    } catch (err) {
       console.error("[calculateTotalAvailableStock] Failed to aggregate seller stock:", err.message);
    }
  }

  return hubAvailableQty + sumSellerQty;
}

/** Catalog stock stored on the product document (not hub + seller). */
export function catalogStockFromProduct(product) {
  return totalVariantStock(product?.variants);
}

/** MongoDB expression: variant sum or root stock (for aggregations). */
export const MONGO_CATALOG_STOCK_EXPR = {
  $reduce: {
    input: { $ifNull: ["$variants", []] },
    initialValue: 0,
    in: { $add: ["$$value", { $ifNull: ["$$this.stock", 0] }] },
  },
};

/** Stock filter: in-stock if root or any variant has qty > 0. */
export function buildSellerStockStatusQuery(stockStatus) {
  if (stockStatus === "in") {
    return {
      $or: [{ stock: { $gt: 0 } }, { variants: { $elemMatch: { stock: { $gt: 0 } } } }],
    };
  }
  if (stockStatus === "out") {
    return {
      $and: [
        { $or: [{ stock: { $lte: 0 } }, { stock: { $exists: false } }] },
        {
          $or: [
            { variants: { $exists: false } },
            { variants: { $size: 0 } },
            { variants: { $not: { $elemMatch: { stock: { $gt: 0 } } } } },
          ],
        },
      ],
    };
  }
  return null;
}

/** Enrich lean product row with normalized catalog stock fields. */
export function enrichSellerProductRow(product) {
  if (!product || typeof product !== "object") return product;
  const catalogStock = catalogStockFromProduct(product);
  const supplyPrice = resolveSupplyPriceFromInput(product);
  const variants = mapSellerVariantsForResponse(product.variants);
  const committedStock = Array.isArray(product.variants) && product.variants.length > 0
    ? product.variants.reduce((sum, v) => sum + (Number(v?.committedStock) || 0), 0)
    : Number(product.committedStock || 0);

  return {
    ...product,
    stock: catalogStock,
    committedStock,
    catalogStock,
    availableQtySeller: Math.max(0, catalogStock - committedStock),
    pricingMode: PRICING_MODE_SUPPLY,
    supplyPrice,
    price: supplyPrice,
    salePrice: supplyPrice,
    purchasePrice: supplyPrice,
    variants,
  };
}

/** Hub row qty (lean HubInventory or API-mapped row). */
export function hubQtyFromInventoryRow(row) {
  if (!row) return 0;
  return Math.max(0, Number(row.availableQty ?? row.hubStockQuantity ?? 0) || 0);
}

/** Split hub total across variant rows (keeps ratios; single variant gets full qty). */
export function distributeQtyAcrossVariants(totalQty, variants = []) {
  const qty = Math.max(0, Number(totalQty) || 0);
  if (!Array.isArray(variants) || !variants.length) return variants;

  const rows = variants.map((v) => ({
    ...v,
    stock: Math.max(0, Number(v?.stock) || 0),
  }));

  if (rows.length === 1) {
    rows[0].stock = qty;
    return rows;
  }

  const sum = rows.reduce((s, v) => s + v.stock, 0);
  if (sum <= 0) {
    rows[0].stock = qty;
    for (let i = 1; i < rows.length; i++) rows[i].stock = 0;
    return rows;
  }

  let assigned = 0;
  for (let i = 0; i < rows.length; i++) {
    if (i === rows.length - 1) {
      rows[i].stock = Math.max(0, qty - assigned);
    } else {
      const part = Math.floor((qty * rows[i].stock) / sum);
      rows[i].stock = part;
      assigned += part;
    }
  }
  return rows;
}

/** Fields clients may set; slug is always generated server-side. */
export const PRODUCT_WRITABLE_KEYS = [
  "name",
  "description",
  "brand",
  "weight",
  "tags",
  "categoryId",
  "subcategoryId",
  "status",
  "isFeatured",
  "masterProductId",
  "variants",
];

export function pickWritableProductFields(body) {
  const out = {};
  for (const k of PRODUCT_WRITABLE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, k)) out[k] = body[k];
  }
  return out;
}

export function stripDeprecatedProductFields(data) {
  delete data.slug;
  delete data.sku;
  delete data.headerId;
  delete data.supplyPrice;
  delete data.customerPrice;
  return data;
}

export function parseBooleanField(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

/** Normalize multipart / JSON body values before save. */
export function normalizeProductBodyFields(data) {
  // We no longer normalize root price fields as they have been removed from the schema.

  if (data.isFeatured !== undefined) {
    data.isFeatured = parseBooleanField(data.isFeatured);
  }

  if (data.masterProductId === "" || data.masterProductId === "null") {
    delete data.masterProductId;
  }

  if (typeof data.tags === "string") {
    data.tags = data.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  if (data.unit) data.unit = normalizeUnit(data.unit);

  return data;
}

/** Root price/stock mirror first variant (legacy fields + home card). */
export function syncRootFromFirstVariant(productData, ownerType = "admin") {
  // Deprecated: no longer syncing pricing/stock to root level
  return productData;
}

/** Pricing slice from first variant for customer catalog cards. */
export function firstVariantPricing(product) {
  const variants = product?.variants || [];
  if (!variants.length) {
    return { price: 0, salePrice: 0, purchasePrice: 0, unit: "Pieces", gstEnabled: false, gstRate: 0 };
  }
  const first = variants[0];
  const mrp = Number(first.price) || 0;
  const sale = Number(first.salePrice ?? first.price) || mrp;
  
  const rawGstRateFirst = Number(first.gstRate) || 0;
  const isGstFirst = !!first.gstEnabled && rawGstRateFirst > 0;
  
  return {
    price: mrp,
    salePrice: sale,
    purchasePrice: Number(first.purchasePrice) || 0,
    unit: first.unit || "Pieces",
    gstEnabled: isGstFirst,
    gstRate: isGstFirst ? rawGstRateFirst : 0,
  };
}

/** Customer-facing list/detail: card uses first variant; keeps all variants for picker. */
export function enrichCustomerProduct(item) {
  if (!item || typeof item !== "object") return item;
  
  let itemRatingDist = item.ratingDistribution;
  if (itemRatingDist instanceof Map) {
    itemRatingDist = Object.fromEntries(itemRatingDist);
  }

  const variants = Array.isArray(item.variants) ? item.variants.map(v => {
    const vObj = { ...v };
    if (vObj.ratingDistribution instanceof Map) {
      vObj.ratingDistribution = Object.fromEntries(vObj.ratingDistribution);
    }
    return vObj;
  }) : [];

  const first = firstVariantPricing(item);
  const sellPrices = variants
    .map((v) => {
      const base = Number(v.salePrice ?? v.price) || 0;
      return base;
    })
    .filter((n) => n > 0);
  const minSell = sellPrices.length ? Math.min(...sellPrices) : first.salePrice;
  const maxSell = sellPrices.length ? Math.max(...sellPrices) : first.salePrice;
  const multi = variants.length > 1;
  const variantLabel =
    multi && minSell !== maxSell
      ? `${variants.length} options · ₹${minSell} – ₹${maxSell}`
      : multi
        ? `${variants.length} options`
        : variants[0]?.name || null;

  const availableQty = variants.length > 0
    ? Number(variants[0].totalAvailableQty ?? variants[0].stock ?? 0)
    : (item.totalAvailableQty !== undefined 
      ? Number(item.totalAvailableQty)
      : totalVariantStock(variants));

  const hasGstVariant = variants.some((v) => v.gstEnabled === true && (Number(v.gstRate) || 0) > 0);
  const gstEnabled = hasGstVariant || first.gstEnabled;

  return {
    ...item,
    ratingDistribution: itemRatingDist,
    variants,
    variantCount: variants.length,
    hasMultipleVariants: multi,
    displayPrice: minSell,
    displayPriceMax: maxSell,
    variantLabel,
    price: first.price,
    salePrice: minSell,
    purchasePrice: first.purchasePrice,
    unit: first.unit,
    stockQty: availableQty,
    inStock: availableQty > 0,
    gstEnabled: gstEnabled,
  };
}

export function mapVariantsForResponse(variants = [], priceOverride = null) {
  return (variants || []).map((v) => {
    const row = typeof v?.toObject === "function" ? v.toObject() : { ...v };
    
    if (row.ratingDistribution instanceof Map) {
      row.ratingDistribution = Object.fromEntries(row.ratingDistribution);
    }

    const stock = Number(row.stock);
    const totalAvailableQty = Number(
      row.totalAvailableQty ?? row.availableQty ?? row.stock ?? 0,
    );
    let price =
      priceOverride != null && priceOverride > 0
        ? priceOverride
        : Number(row.price) || 0;
    let salePrice =
      priceOverride != null && priceOverride > 0
        ? priceOverride
        : Number(row.salePrice ?? row.price) || 0;

    return {
      ...row,
      unit: normalizeUnit(row.unit),
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
      totalAvailableQty: Number.isFinite(totalAvailableQty) && totalAvailableQty >= 0
        ? totalAvailableQty
        : Number.isFinite(stock) && stock >= 0
          ? stock
          : 0,
      price: price,
      salePrice: salePrice,
    };
  });
}

/** Seller listing mapped to an admin master catalog product. */
export function isSellerCatalogLinkedListing(product) {
  return product?.ownerType === "seller" && !!product?.masterProductId;
}

/**
 * Merge seller price/stock updates into an existing catalog-linked listing.
 * Variant names, units, and media stay tied to the master product.
 */
export function mergeSellerCatalogListingPricing(product, rawVariants, rootFields = {}) {
  const existingVariants = Array.isArray(product?.variants)
    ? product.variants.map((v) => (typeof v?.toObject === "function" ? v.toObject() : { ...v }))
    : [];
  const incoming = parseVariantsField(rawVariants);

  const incomingOffered = incoming.filter((row) => resolveSupplyPriceFromVariantRow(row) > 0);

  if (existingVariants.length === 0) {
    if (incomingOffered.length > 0) {
      const merged = incomingOffered.map((iv, idx) => {
        const supply = resolveSupplyPriceFromVariantRow(iv);
        return {
          name: String(iv.name || "").trim() || `Variant ${idx + 1}`,
          unit: normalizeUnit(iv.unit, product.unit),
          price: supply,
          salePrice: supply,
          purchasePrice: supply,
          stock: Math.max(0, Number(iv.stock) || 0),
          gstEnabled: Boolean(iv.gstEnabled),
          gstRate: iv.gstEnabled ? Math.max(0, Number(iv.gstRate) || 0) : 0,
        };
      });
      const firstPrice = Number(merged[0]?.price) || 0;
      return {
        ok: true,
        data: {
          price: firstPrice,
          salePrice: firstPrice,
          purchasePrice: firstPrice,
          stock: totalVariantStock(merged),
          variants: normalizeSellerVariants(merged, {
            defaultUnit: product.unit,
            baseSupply: firstPrice,
          }),
        },
      };
    }

    const iv = incoming[0] || {};
    const price =
      resolveSupplyPriceFromVariantRow(iv, rootFields.price) || 0;
    const stock = Math.max(
      0,
      Number(iv.stock ?? rootFields.stock ?? product.stock) || 0,
    );
    if (price <= 0) {
      return { ok: false, message: "Supply price must be greater than 0 for at least one variant" };
    }
    return {
      ok: true,
      data: {
        price,
        salePrice: price,
        purchasePrice: price,
        stock,
        variants: [],
      },
    };
  }

  if (existingVariants.length > 0) {
    const mergedById = new Map();
    for (const ev of existingVariants) {
      const key = String(ev._id || ev.name || "").trim().toLowerCase();
      mergedById.set(key, {
        ...(typeof ev?.toObject === "function" ? ev.toObject() : { ...ev }),
      });
    }

    for (const iv of incomingOffered) {
      const norm = String(iv?.name || "").trim().toLowerCase();
      const existing =
        existingVariants.find(
          (ev) => String(ev?.name || "").trim().toLowerCase() === norm,
        ) || null;
      const supply = resolveSupplyPriceFromVariantRow(iv);
      const stock = Math.max(0, Number(iv.stock ?? existing?.stock) || 0);
      const unit = iv.unit || existing?.unit || product.unit;
      const row = {
        ...(existing
          ? typeof existing?.toObject === "function"
            ? existing.toObject()
            : { ...existing }
          : { name: iv.name, unit }),
        name: String(iv.name || existing?.name || "").trim() || existing?.name,
        unit,
        price: supply,
        salePrice: supply,
        purchasePrice: supply,
        stock,
      };
      if (iv.gstEnabled !== undefined) {
        row.gstEnabled = Boolean(iv.gstEnabled);
        row.gstRate = row.gstEnabled ? Math.max(0, Number(iv.gstRate) || 0) : 0;
      }
      const key = String(existing?._id || row.name || "").trim().toLowerCase();
      mergedById.set(key, row);
    }

    const merged = [...mergedById.values()].filter(
      (v) => resolveSupplyPriceFromVariantRow(v) > 0,
    );
    const firstPrice =
      merged.find((v) => resolveSupplyPriceFromVariantRow(v) > 0)?.price || 0;
    if (firstPrice <= 0) {
      return { ok: false, message: "Supply price must be greater than 0 for at least one variant" };
    }

    return {
      ok: true,
      data: {
        price: firstPrice,
        salePrice: firstPrice,
        purchasePrice: firstPrice,
        stock: totalVariantStock(merged),
        variants: normalizeSellerVariants(merged, {
          defaultUnit: product.unit,
          baseSupply: firstPrice,
        }),
      },
    };
  }

  return { ok: false, message: "Supply price must be greater than 0 for at least one variant" };
}

/** Restrict seller updates on hub-catalog listings to price and stock only. */
export function sanitizeSellerCatalogListingUpdate(product, productData, reqBody = {}) {
  const merged = mergeSellerCatalogListingPricing(
    product,
    productData.variants ?? reqBody.variants,
    {
      price: productData.price ?? reqBody.price,
      purchasePrice:
        productData.purchasePrice ?? reqBody.purchasePrice ?? reqBody.supplyPrice,
      stock: productData.stock ?? reqBody.stock,
    },
  );
  if (!merged.ok) return merged;
  return { ok: true, data: merged.data };
}

/** Seller supply listing: procurement price + stock only (linked to a master catalog item). */
export function sanitizeSellerSupplyListingUpdate(product, productData, reqBody = {}) {
  if (isSellerCatalogLinkedListing(product) || product?.masterProductId) {
    return sanitizeSellerCatalogListingUpdate(product, productData, reqBody);
  }

  const supply = resolveSupplyPriceFromInput({ ...reqBody, ...productData });
  const stock = Math.max(0, Number(productData.stock ?? reqBody.stock ?? product.stock) || 0);

  if (Number.isFinite(supply) && supply > 0) {
    return {
      ok: true,
      data: {
        price: supply,
        salePrice: supply,
        purchasePrice: supply,
        stock,
      },
    };
  }

  if (productData.stock !== undefined || reqBody.stock !== undefined) {
    return { ok: true, data: { stock } };
  }

  return {
    ok: false,
    message: "Sellers can only update supply price and stock on live listings.",
  };
}

/**
 * Pending seller-owned submission (no master yet): allow descriptive fields,
 * but customer MRP / selling price / images on master are admin-only after go-live.
 */
export function sanitizeSellerPendingSubmissionUpdate(product, productData, reqBody = {}) {
  const allowed = {};
  const textKeys = ["name", "description", "brand", "weight", "categoryId", "subcategoryId", "unit", "tags"];
  for (const key of textKeys) {
    if (productData[key] !== undefined) allowed[key] = productData[key];
  }

  if (productData.lowStockAlert !== undefined) {
    allowed.lowStockAlert = productData.lowStockAlert;
  }

  const supply = resolveSupplyPriceFromInput({ ...reqBody, ...productData });
  if (Number.isFinite(supply) && supply > 0) {
    allowed.price = supply;
    allowed.salePrice = supply;
    allowed.purchasePrice = supply;
  }

  if (productData.stock !== undefined || reqBody.stock !== undefined) {
    allowed.stock = Math.max(0, Number(productData.stock ?? reqBody.stock) || 0);
  }

  if (productData.variants !== undefined || reqBody.variants !== undefined) {
    const raw = parseVariantsField(productData.variants ?? reqBody.variants);
    if (raw.length > 0) {
      const baseSupply =
        Number.isFinite(supply) && supply > 0
          ? supply
          : resolveSupplyPriceFromInput(product) || 0;
      allowed.variants = normalizeSellerVariants(raw, {
        defaultUnit: allowed.unit || product.unit,
        baseSupply,
      });
      allowed.stock = totalVariantStock(allowed.variants);
    }
  }

  return { ok: true, data: allowed, allowImages: true };
}

/** Route seller updates: catalog-linked / live = supply only; pending = submission fields. */
export function sanitizeSellerProductUpdate(product, productData, reqBody = {}) {
  const isPendingOwn =
    product?.ownerType === "seller" &&
    !product?.masterProductId &&
    String(product?.status || "") === "pending_approval";

  if (isPendingOwn) {
    return sanitizeSellerPendingSubmissionUpdate(product, productData, reqBody);
  }

  return sanitizeSellerSupplyListingUpdate(product, productData, reqBody);
}

/** Copy master catalog presentation fields onto a seller listing payload. */
export function inheritMasterCatalogFields(productData, master) {
  if (!master) return productData;
  productData.name = master.name;
  productData.description = master.description || "";
  productData.brand = master.brand || "";
  productData.weight = master.weight || "";
  productData.unit = master.unit || productData.unit;
  productData.categoryId = master.categoryId;
  productData.subcategoryId = master.subcategoryId;
  productData.mainImage = master.mainImage || null;
  productData.galleryImages = Array.isArray(master.galleryImages) ? master.galleryImages : [];
  return productData;
}

function findGoLivePriceRow(priceInputs = [], variantName = "", index = 0) {
  const norm = normalizeVariantMatchKey(variantName);
  const byName = priceInputs.find((p) => normalizeVariantMatchKey(p?.name) === norm);
  return byName || priceInputs[index] || {};
}

function getSellerVariantRows(sellerProduct) {
  if (Array.isArray(sellerProduct?.variants) && sellerProduct.variants.length > 0) {
    return sellerProduct.variants.map((v) =>
      typeof v?.toObject === "function" ? v.toObject() : { ...v },
    );
  }
  return [
    {
      name: "Default",
      unit: sellerProduct?.unit,
      stock: Number(sellerProduct?.stock) || 0,
    },
  ];
}

function parseGoLiveVariantRow(priceRow = {}, sellerSupply = 0, defaultSell = 0) {
  const salePrice =
    Number(priceRow?.salePrice ?? priceRow?.customerPrice) ||
    defaultSell ||
    0;
  const rawMrp = Number(priceRow?.price ?? priceRow?.mrp);
  const price =
    Number.isFinite(rawMrp) && rawMrp > 0
      ? Math.max(rawMrp, salePrice)
      : salePrice > 0
        ? salePrice
        : 0;
  const rawPurchase = Number(priceRow?.purchasePrice);
  const purchasePrice =
    Number.isFinite(rawPurchase) && rawPurchase > 0
      ? rawPurchase
      : sellerSupply > 0
        ? sellerSupply
        : 0;
  return { price, salePrice, purchasePrice };
}

/** Build admin master variants for go-live from seller supply + admin pricing input. */
export function buildMasterVariantsForGoLive(sellerProduct, priceInputs = [], defaultSell = 0) {
  const source = getSellerVariantRows(sellerProduct);
  const rows = source.map((sv, i) => {
    const row = findGoLivePriceRow(priceInputs, sv.name, i);
    const supply = resolveSupplyPriceFromVariantRow(
      sv,
      resolveSupplyPriceFromInput(sellerProduct),
    );
    const { price, salePrice, purchasePrice } = parseGoLiveVariantRow(row, supply, defaultSell);
    const { gstEnabled, gstRate } = normalizeVariantGstFields({
      gstEnabled: row.gstEnabled ?? sv.adminExtraGstEnabled ?? false,
      gstRate: row.gstRate ?? sv.adminExtraGstRate ?? 0,
    });
    return {
      name: sv.name,
      unit: sv.unit || sellerProduct.unit,
      price,
      salePrice,
      purchasePrice,
      stock: 0,
      gstEnabled,
      gstRate,
    };
  });
  if (!rows.length) return [];
  const first = rows[0];
  return normalizeAdminVariants(rows, {
    defaultUnit: sellerProduct.unit,
    basePrice: first.price,
    baseSalePrice: first.salePrice,
    basePurchasePrice: first.purchasePrice,
  });
}

/** Apply admin go-live pricing onto an existing master catalog product. */
export function applyGoLivePricingToMaster(
  master,
  priceInputs = [],
  sellerProduct = null,
  defaultSell = 0,
) {
  const update = { status: "active" };
  const sellerRows = sellerProduct ? getSellerVariantRows(sellerProduct) : [];

  if (master.variants?.length > 0) {
    update.variants = master.variants.map((mv, i) => {
      const obj = typeof mv?.toObject === "function" ? mv.toObject() : { ...mv };
      const row = findGoLivePriceRow(priceInputs, obj.name, i);
       const objKey = normalizeVariantMatchKey(obj.name);
       const sellerVar =
         sellerRows.find((s) => normalizeVariantMatchKey(s?.name) === objKey) || sellerRows[i];
      const fallbackSell = defaultSell || Number(obj.salePrice ?? obj.price) || 0;
      const existingPurchasePrice = Number(obj.purchasePrice) || 0;
      const { price, salePrice, purchasePrice } = parseGoLiveVariantRow(row, existingPurchasePrice, fallbackSell);
      const { gstEnabled, gstRate } = normalizeVariantGstFields({
        gstEnabled: row.gstEnabled ?? sellerVar?.gstEnabled ?? obj.gstEnabled,
        gstRate: row.gstRate ?? sellerVar?.gstRate ?? obj.gstRate,
      });
      return {
        ...obj,
        price: price > 0 ? price : Math.max(Number(obj.price) || 0, fallbackSell),
        salePrice: salePrice > 0 ? salePrice : fallbackSell,
        purchasePrice:
          purchasePrice > 0 ? purchasePrice : existingPurchasePrice,
        stock: Math.max(0, Number(obj.stock) || 0),
        gstEnabled,
        gstRate,
      };
    });
    syncRootFromFirstVariant(update, "admin");
    update.stock = totalVariantStock(update.variants);
  } else {
    const row = priceInputs[0] || {};
    const existingPurchasePrice = Number(master.purchasePrice) || 0;
    const parsed = parseGoLiveVariantRow(row, existingPurchasePrice, defaultSell);
    if (parsed.salePrice > 0) {
      update.price = parsed.price;
      update.salePrice = parsed.salePrice;
      update.purchasePrice = parsed.purchasePrice;
    } else if (defaultSell > 0) {
      update.price = defaultSell;
      update.salePrice = defaultSell;
      update.purchasePrice = existingPurchasePrice;
    }
  }
  return update;
}

function hasAdminPricingInBody(body = {}) {
  return ["price", "salePrice", "purchasePrice", "mrp"].some(
    (k) => body[k] !== undefined && body[k] !== null && body[k] !== "",
  );
}

/** Optional admin pricing on stock update (root product or one variant row). */
export function applyAdminPricingFromStockPayload(product, body = {}, variantIndex = -1) {
  if (!hasAdminPricingInBody(body)) return false;

  const patch = {};
  if (body.mrp !== undefined && body.mrp !== "") patch.price = Number(body.mrp);
  if (body.price !== undefined && body.price !== "") patch.price = Number(body.price);
  if (body.salePrice !== undefined && body.salePrice !== "") {
    patch.salePrice = Number(body.salePrice);
  }
  if (body.purchasePrice !== undefined && body.purchasePrice !== "") {
    patch.purchasePrice = Number(body.purchasePrice);
  }

  if (variantIndex >= 0 && Array.isArray(product.variants) && product.variants.length > variantIndex) {
    const variants = product.variants.map((v, i) => {
      const obj = typeof v?.toObject === "function" ? v.toObject() : { ...v };
      if (i !== variantIndex) return obj;
      const sale =
        patch.salePrice !== undefined
          ? patch.salePrice
          : Number(obj.salePrice ?? obj.price) || 0;
      const mrp = patch.price !== undefined ? patch.price : Number(obj.price) || sale;
      const purchase =
        patch.purchasePrice !== undefined
          ? patch.purchasePrice
          : Number(obj.purchasePrice) || 0;
      return {
        ...obj,
        price: Math.max(mrp, sale),
        salePrice: sale,
        purchasePrice: purchase,
      };
    });
    product.variants = variants;
    product.markModified("variants");
    syncRootFromFirstVariant(product, "admin");
    return true;
  }

  // We no longer set root pricing fields on product as they were removed
  return true;
}
