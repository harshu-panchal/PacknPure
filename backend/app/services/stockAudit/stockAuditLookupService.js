import Product from "../../models/product.js";
import {
  findVariantByBarcode,
  getVariantBarcodeValue,
  normalizeBarcodeScan,
} from "../posProviders/barcodeLookup.js";
import {
  buildCanonicalStockContext,
  getSellerProductStockView,
} from "../inventoryReadService.js";
import { normalizeVariantMatchKey } from "../../utils/productHelpers.js";

/**
 * Resolve a scanned barcode to product/variant + expected physical qty.
 * READ-ONLY — never mutates inventory.
 *
 * @param {string} rawBarcode
 * @param {object} ctx
 * @param {'admin'|'seller'} ctx.role
 * @param {string} [ctx.sellerId] required for seller role
 * @param {'hub'|'warehouse'|'seller_store'} [ctx.locationType]
 */
export async function resolveBarcodeForAudit(rawBarcode, ctx = {}) {
  const barcode = normalizeBarcodeScan(rawBarcode);
  if (!barcode) {
    const err = new Error("Invalid barcode");
    err.code = "AUDIT_INVALID_BARCODE";
    throw err;
  }

  const role = String(ctx.role || "").toLowerCase();
  const locationType = String(ctx.locationType || "").toLowerCase();

  if (role === "seller") {
    return resolveSellerBarcode(barcode, ctx.sellerId);
  }

  // Admin auditing a seller store (optional): look up that seller's barcode.
  if (locationType === "seller_store" && ctx.sellerId) {
    return resolveSellerBarcode(barcode, ctx.sellerId);
  }

  return resolveAdminBarcode(barcode);
}

async function resolveAdminBarcode(barcode) {
  const product = await Product.findOne({
    ownerType: "admin",
    $or: [
      { "variants.barcodeValue": barcode },
      { "variants.barcodeId": barcode },
    ],
  }).lean();

  if (!product) {
    const err = new Error("Product not found");
    err.code = "AUDIT_NOT_FOUND";
    throw err;
  }
  if (product.status !== "active") {
    const err = new Error(`"${product.name}" is inactive`);
    err.code = "AUDIT_INACTIVE";
    throw err;
  }

  const variant = findVariantByBarcode(product, barcode, { ownerType: "admin" });
  if (!variant) {
    const err = new Error("Variant not found for barcode");
    err.code = "AUDIT_NOT_FOUND";
    throw err;
  }

  const canonicalCtx = await buildCanonicalStockContext([product._id]);
  const view = canonicalCtx.productViews.get(String(product._id));
  const vv = view?.variantByKey?.get(normalizeVariantMatchKey(variant.name));

  // Physical hub stock for the variant (canonical availableQtyHub / stock).
  const expectedQty = Math.max(
    0,
    Number(vv?.availableQtyHub ?? vv?.stock ?? variant.stock) || 0,
  );

  return {
    barcodeValue: getVariantBarcodeValue(variant, "admin") || barcode,
    productId: product._id,
    variantId: variant._id || null,
    productName: product.name || "",
    variantName: variant.name || "",
    unit: variant.unit || "",
    expectedQty,
    ownerType: "admin",
  };
}

async function resolveSellerBarcode(barcode, sellerId) {
  if (!sellerId) {
    const err = new Error("Seller scope is required");
    err.code = "AUDIT_FORBIDDEN";
    throw err;
  }

  const product = await Product.findOne({
    ownerType: "seller",
    sellerId,
    $or: [
      { "variants.sellerBarcodeValue": barcode },
      { "variants.sellerBarcodeId": barcode },
    ],
  }).lean();

  if (!product) {
    const err = new Error("Product not found");
    err.code = "AUDIT_NOT_FOUND";
    throw err;
  }
  if (product.status !== "active") {
    const err = new Error(`"${product.name}" is inactive`);
    err.code = "AUDIT_INACTIVE";
    throw err;
  }

  const variant = findVariantByBarcode(product, barcode, { ownerType: "seller" });
  if (!variant) {
    const err = new Error("Variant not found for barcode");
    err.code = "AUDIT_NOT_FOUND";
    throw err;
  }

  const stockView = getSellerProductStockView(product);
  const idx = product.variants.findIndex(
    (v) => String(v._id) === String(variant._id),
  );
  const vv = idx >= 0 ? stockView.variants[idx] : null;

  // Physical shelf count = gross stock on seller listing variant.
  const expectedQty = Math.max(
    0,
    Number(vv?.grossStock ?? variant.stock) || 0,
  );

  return {
    barcodeValue: getVariantBarcodeValue(variant, "seller") || barcode,
    productId: product._id,
    variantId: variant._id || null,
    productName: product.name || "",
    variantName: variant.name || "",
    unit: variant.unit || "",
    expectedQty,
    ownerType: "seller",
    sellerId,
  };
}
