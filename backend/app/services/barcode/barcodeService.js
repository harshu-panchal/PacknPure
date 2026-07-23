import Product from "../../models/product.js";
import {
  generateAdminBarcodeIdentity,
  generateSellerBarcodeIdentity,
} from "./barcodeGenerator.js";

const ADMIN_BARCODE_KEYS = ["barcodeId", "barcodeValue", "barcodeGeneratedAt"];
const SELLER_BARCODE_KEYS = [
  "sellerBarcodeId",
  "sellerBarcodeValue",
  "sellerBarcodeGeneratedAt",
];

export function hasAdminBarcode(variant) {
  return Boolean(variant?.barcodeValue);
}

export function hasSellerBarcode(variant) {
  return Boolean(variant?.sellerBarcodeValue);
}

/**
 * Copy immutable barcode fields from a previous variant onto a new row.
 * Never overwrites an already-set value on the target.
 */
export function copyBarcodeFields(fromVariant, toVariant) {
  if (!fromVariant || !toVariant) return toVariant;
  for (const key of ADMIN_BARCODE_KEYS) {
    if (fromVariant[key] != null && toVariant[key] == null) {
      toVariant[key] = fromVariant[key];
    }
  }
  for (const key of SELLER_BARCODE_KEYS) {
    if (fromVariant[key] != null && toVariant[key] == null) {
      toVariant[key] = fromVariant[key];
    }
  }
  return toVariant;
}

function matchPreviousVariant(previousVariants = [], nextVariant, index) {
  if (!Array.isArray(previousVariants) || !previousVariants.length) return null;

  const nextId = nextVariant?._id || nextVariant?.id;
  if (nextId) {
    const byId = previousVariants.find(
      (v) => v?._id && String(v._id) === String(nextId),
    );
    if (byId) return byId;
  }

  const nextName = String(nextVariant?.name || "")
    .trim()
    .toLowerCase();
  if (nextName) {
    const byName = previousVariants.find(
      (v) => String(v?.name || "").trim().toLowerCase() === nextName,
    );
    if (byName) return byName;
  }

  return previousVariants[index] || null;
}

/**
 * Re-apply existing barcodes onto newly normalized variant rows.
 * Prevents accidental wipe during product updates.
 */
export function preserveVariantBarcodes(previousVariants = [], nextVariants = []) {
  if (!Array.isArray(nextVariants) || !nextVariants.length) return nextVariants;

  return nextVariants.map((raw, index) => {
    const next =
      typeof raw?.toObject === "function" ? raw.toObject() : { ...raw };
    const prev = matchPreviousVariant(previousVariants, next, index);
    if (prev) copyBarcodeFields(prev, next);
    return next;
  });
}

/**
 * Strip client-supplied barcode fields so identities stay server-owned.
 */
export function stripClientBarcodeFields(variants) {
  if (!Array.isArray(variants)) return variants;
  return variants.map((v) => {
    if (!v || typeof v !== "object") return v;
    const next =
      typeof v.toObject === "function" ? v.toObject() : { ...v };
    for (const key of [...ADMIN_BARCODE_KEYS, ...SELLER_BARCODE_KEYS]) {
      delete next[key];
    }
    return next;
  });
}

async function assignAdminBarcode(variant) {
  if (hasAdminBarcode(variant)) return false;
  const identity = await generateAdminBarcodeIdentity();
  variant.barcodeId = identity.barcodeId;
  variant.barcodeValue = identity.barcodeValue;
  variant.barcodeGeneratedAt = new Date();
  return true;
}

async function assignSellerBarcode(variant) {
  if (hasSellerBarcode(variant)) return false;
  const identity = await generateSellerBarcodeIdentity();
  variant.sellerBarcodeId = identity.sellerBarcodeId;
  variant.sellerBarcodeValue = identity.sellerBarcodeValue;
  variant.sellerBarcodeGeneratedAt = new Date();
  return true;
}

/**
 * Ensure barcodes exist for a product's variants.
 * - Admin masters: permanent barcodeId/barcodeValue (once)
 * - Seller listings: sellerBarcode* on first need (once)
 *
 * Never regenerates existing barcodes. Failures are thrown to the caller
 * so controllers can catch without breaking product create/update.
 *
 * @param {string|object} productOrId
 * @param {object} [opts]
 * @param {boolean} [opts.forceSeller] - generate seller barcodes even if stock is 0
 * @param {string[]} [opts.variantIds] - only ensure these variant ids
 * @returns {Promise<{ product: object|null, generated: number, skipped: number }>}
 */
export async function ensureProductBarcodes(productOrId, opts = {}) {
  const productId =
    typeof productOrId === "object" && productOrId?._id
      ? productOrId._id
      : productOrId;

  if (!productId) {
    return { product: null, generated: 0, skipped: 0 };
  }

  const product = await Product.findById(productId);
  if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
    return { product, generated: 0, skipped: 0 };
  }

  const ownerType = String(product.ownerType || "").toLowerCase();
  const isAdmin = ownerType === "admin";
  const isSeller = ownerType === "seller";
  const variantIdFilter = Array.isArray(opts.variantIds)
    ? new Set(opts.variantIds.map(String))
    : null;

  let generated = 0;
  let skipped = 0;
  let mutated = false;

  for (const variant of product.variants) {
    if (
      variantIdFilter &&
      !variantIdFilter.has(String(variant._id || ""))
    ) {
      skipped += 1;
      continue;
    }

    if (isAdmin) {
      if (hasAdminBarcode(variant)) {
        skipped += 1;
        continue;
      }
      const did = await assignAdminBarcode(variant);
      if (did) {
        generated += 1;
        mutated = true;
      }
    } else if (isSeller) {
      if (hasSellerBarcode(variant)) {
        skipped += 1;
        continue;
      }
      // First-time seller barcode: create listing or first stock touch.
      // Always generate for seller variants that lack one (once).
      const did = await assignSellerBarcode(variant);
      if (did) {
        generated += 1;
        mutated = true;
      }
    } else {
      skipped += 1;
    }
  }

  if (mutated) {
    product.markModified("variants");
    await product.save();
  }

  return { product, generated, skipped };
}

/**
 * Safe wrapper: never throws to callers that must not break product flows.
 */
export async function ensureProductBarcodesSafe(productOrId, opts = {}) {
  try {
    return await ensureProductBarcodes(productOrId, opts);
  } catch (err) {
    console.warn(
      "[Barcode] ensureProductBarcodes failed:",
      err?.message || err,
    );
    return {
      product: null,
      generated: 0,
      skipped: 0,
      error: err?.message || "Barcode generation failed",
    };
  }
}

/**
 * Collect printable barcode rows for a product.
 * Admin → admin barcodes; Seller → seller barcodes.
 * @param {object} [opts]
 * @param {boolean} [opts.onlyMissingPdfFlag] - unused placeholder
 * @param {boolean} [opts.newlyCreatedOnly] - if true, only rows generated in last few minutes (seller PDF filter)
 * @param {Date} [opts.since] - with newlyCreatedOnly
 */
export function collectBarcodeLabelRows(product, opts = {}) {
  if (!product || !Array.isArray(product.variants)) return [];

  const ownerType = String(product.ownerType || "").toLowerCase();
  const rows = [];

  for (const variant of product.variants) {
    let value = null;
    let generatedAt = null;
    let barcodeId = null;

    if (ownerType === "admin") {
      value = variant.barcodeValue || null;
      generatedAt = variant.barcodeGeneratedAt || null;
      barcodeId = variant.barcodeId || null;
    } else if (ownerType === "seller") {
      value = variant.sellerBarcodeValue || null;
      generatedAt = variant.sellerBarcodeGeneratedAt || null;
      barcodeId = variant.sellerBarcodeId || null;
    }

    if (!value) continue;

    if (opts.newlyCreatedOnly) {
      const since = opts.since ? new Date(opts.since) : null;
      if (since && generatedAt && new Date(generatedAt) < since) {
        continue;
      }
      // If no since provided, include only barcodes generated in this request window via variantIds
      if (Array.isArray(opts.variantIds) && opts.variantIds.length > 0) {
        if (!opts.variantIds.map(String).includes(String(variant._id))) {
          continue;
        }
      }
    }

    rows.push({
      productId: String(product._id),
      productName: product.name || "",
      variantId: variant._id ? String(variant._id) : null,
      variantName: variant.name || "",
      unit: variant.unit || "",
      barcodeId,
      barcodeValue: value,
      barcodeGeneratedAt: generatedAt,
    });
  }

  return rows;
}
