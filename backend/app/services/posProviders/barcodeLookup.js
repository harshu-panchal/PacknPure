/**
 * Helpers for POS barcode scan resolution (Phase 2).
 * Barcode stores only immutable identity (PNP-ADM-… / PNP-SLR-…).
 */

export function normalizeBarcodeScan(raw) {
  return String(raw || "")
    .trim()
    .replace(/[\r\n]+/g, "");
}

/** True when the token looks like a PacknPure Code128 identity. */
export function looksLikePacknPureBarcode(raw) {
  const value = normalizeBarcodeScan(raw);
  return /^PNP-(ADM|SLR)-[0-9A-Z]+$/i.test(value);
}

/**
 * Resolve which variant row matches a scanned barcode on a product doc.
 */
export function findVariantByBarcode(product, scanned, { ownerType } = {}) {
  const code = normalizeBarcodeScan(scanned);
  if (!code || !product || !Array.isArray(product.variants)) return null;

  const role = String(ownerType || product.ownerType || "").toLowerCase();

  return (
    product.variants.find((v) => {
      if (role === "seller") {
        return (
          String(v?.sellerBarcodeValue || "") === code ||
          String(v?.sellerBarcodeId || "") === code
        );
      }
      return (
        String(v?.barcodeValue || "") === code ||
        String(v?.barcodeId || "") === code
      );
    }) || null
  );
}

export function getVariantBarcodeValue(variant, ownerType) {
  if (!variant) return null;
  if (String(ownerType || "").toLowerCase() === "seller") {
    return variant.sellerBarcodeValue || variant.sellerBarcodeId || null;
  }
  return variant.barcodeValue || variant.barcodeId || null;
}
