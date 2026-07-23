import Product from "../../models/product.js";
import getPagination from "../../utils/pagination.js";
import { ensureProductBarcodesSafe } from "./barcodeService.js";

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build Mongo filter for barcode sticker catalog (isolated from product APIs).
 * Seller scope is always forced to own sellerId.
 */
export function buildBarcodeCatalogFilter(user, query = {}) {
  const role = String(user?.role || "").toLowerCase();
  const filter = {};

  if (role === "seller") {
    filter.ownerType = "seller";
    filter.sellerId = user.id;
  } else {
    // Admin: default to master catalog; optional ownerType override
    const ownerType = String(query.ownerType || "admin").toLowerCase();
    if (ownerType === "seller" || ownerType === "admin") {
      filter.ownerType = ownerType;
    }
    if (query.sellerId) {
      filter.sellerId = query.sellerId;
    }
  }

  if (query.categoryId) {
    filter.categoryId = query.categoryId;
  }
  if (query.subcategoryId) {
    filter.subcategoryId = query.subcategoryId;
  }
  if (query.brand) {
    filter.brand = {
      $regex: `^${escapeRegex(String(query.brand).trim())}$`,
      $options: "i",
    };
  }

  const search = String(query.search || "").trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [
      { name: rx },
      { brand: rx },
      { "variants.name": rx },
      { "variants.barcodeValue": rx },
      { "variants.barcodeId": rx },
      { "variants.sellerBarcodeValue": rx },
      { "variants.sellerBarcodeId": rx },
    ];
  }

  return filter;
}

function variantHasBarcode(variant, ownerType) {
  if (String(ownerType) === "seller") {
    return Boolean(variant?.sellerBarcodeValue);
  }
  return Boolean(variant?.barcodeValue);
}

function getVariantBarcodeFields(variant, ownerType) {
  if (String(ownerType) === "seller") {
    return {
      barcodeId: variant.sellerBarcodeId || null,
      barcodeValue: variant.sellerBarcodeValue || null,
      barcodeGeneratedAt: variant.sellerBarcodeGeneratedAt || null,
    };
  }
  return {
    barcodeId: variant.barcodeId || null,
    barcodeValue: variant.barcodeValue || null,
    barcodeGeneratedAt: variant.barcodeGeneratedAt || null,
  };
}

/**
 * Flatten products → sticker rows (one per variant).
 */
export function flattenProductsToStickerRows(products = []) {
  const rows = [];
  for (const product of products) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    for (const variant of variants) {
      const barcode = getVariantBarcodeFields(variant, product.ownerType);
      rows.push({
        productId: String(product._id),
        productName: product.name || "",
        brand: product.brand || "",
        categoryId: product.categoryId || null,
        subcategoryId: product.subcategoryId || null,
        ownerType: product.ownerType,
        sellerId: product.sellerId || null,
        status: product.status,
        variantId: variant._id ? String(variant._id) : null,
        variantName: variant.name || "",
        unit: variant.unit || "",
        hasBarcode: Boolean(barcode.barcodeValue),
        barcodeId: barcode.barcodeId,
        barcodeValue: barcode.barcodeValue,
        barcodeGeneratedAt: barcode.barcodeGeneratedAt,
      });
    }
  }
  return rows;
}

function applyBarcodeStatusFilter(rows, barcodeStatus) {
  const status = String(barcodeStatus || "all").toLowerCase();
  if (status === "generated" || status === "has") {
    return rows.filter((r) => r.hasBarcode);
  }
  if (status === "missing") {
    return rows.filter((r) => !r.hasBarcode);
  }
  return rows;
}

/**
 * Paginated barcode sticker catalog for admin/seller management UI.
 */
export async function listBarcodeCatalog(user, query = {}) {
  const { page, limit, skip } = getPagination(
    { query },
    { defaultLimit: 25, maxLimit: 100 },
  );

  const filter = buildBarcodeCatalogFilter(user, query);
  const barcodeStatus = String(query.barcodeStatus || "all").toLowerCase();
  const roleOwnerType =
    String(user?.role || "").toLowerCase() === "seller"
      ? "seller"
      : String(query.ownerType || filter.ownerType || "admin");

  if (barcodeStatus === "missing") {
    if (roleOwnerType === "seller") {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { "variants.sellerBarcodeValue": { $exists: false } },
            { "variants.sellerBarcodeValue": null },
            { "variants.sellerBarcodeValue": "" },
          ],
        },
      ];
    } else {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { "variants.barcodeValue": { $exists: false } },
            { "variants.barcodeValue": null },
            { "variants.barcodeValue": "" },
          ],
        },
      ];
    }
  } else if (barcodeStatus === "generated" || barcodeStatus === "has") {
    if (roleOwnerType === "seller") {
      filter["variants.sellerBarcodeValue"] = { $type: "string", $ne: "" };
    } else {
      filter["variants.barcodeValue"] = { $type: "string", $ne: "" };
    }
  }

  // Fetch a bounded window then flatten — variants live embedded on products.
  const [products, productTotal] = await Promise.all([
    Product.find(filter)
      .select(
        "name brand categoryId subcategoryId ownerType sellerId status variants",
      )
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  let rows = flattenProductsToStickerRows(products);
  rows = applyBarcodeStatusFilter(rows, barcodeStatus);

  return {
    items: rows,
    page,
    limit,
    total: productTotal,
    totalPages: Math.max(1, Math.ceil(productTotal / limit) || 1),
    productTotal,
  };
}

/**
 * Ensure barcodes only for products that have at least one missing variant.
 * Never regenerates existing barcodes.
 */
export async function ensureMissingBarcodesForScope(user, opts = {}) {
  const role = String(user?.role || "").toLowerCase();
  const filter = {};

  if (Array.isArray(opts.productIds) && opts.productIds.length > 0) {
    filter._id = { $in: opts.productIds };
    if (role === "seller") {
      filter.ownerType = "seller";
      filter.sellerId = user.id;
    }
  } else if (role === "seller") {
    filter.ownerType = "seller";
    filter.sellerId = user.id;
    filter.$or = [
      { "variants.sellerBarcodeValue": { $exists: false } },
      { "variants.sellerBarcodeValue": null },
      { "variants.sellerBarcodeValue": "" },
    ];
  } else {
    filter.ownerType = String(opts.ownerType || "admin");
    filter.$or = [
      { "variants.barcodeValue": { $exists: false } },
      { "variants.barcodeValue": null },
      { "variants.barcodeValue": "" },
    ];
  }

  const products = await Product.find(filter)
    .select("_id name ownerType")
    .limit(Math.min(100, Number(opts.limit) || 50))
    .lean();

  let generated = 0;
  let skipped = 0;
  const results = [];

  for (const product of products) {
    const outcome = await ensureProductBarcodesSafe(product._id);
    generated += outcome.generated || 0;
    skipped += outcome.skipped || 0;
    results.push({
      productId: String(product._id),
      productName: product.name,
      generated: outcome.generated || 0,
      skipped: outcome.skipped || 0,
      error: outcome.error || null,
    });
  }

  return { generated, skipped, processed: products.length, results };
}

/**
 * Distinct brands for filter dropdown (scoped).
 */
export async function listBarcodeCatalogBrands(user) {
  const filter =
    String(user?.role || "").toLowerCase() === "seller"
      ? { ownerType: "seller", sellerId: user.id, brand: { $nin: [null, ""] } }
      : { ownerType: "admin", brand: { $nin: [null, ""] } };

  const brands = await Product.distinct("brand", filter);
  return brands
    .map((b) => String(b || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}
