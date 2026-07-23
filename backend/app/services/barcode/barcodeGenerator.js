import { getNextSequenceValue } from "../posSequenceService.js";

const ADMIN_PREFIX = "PNP-ADM-";
const SELLER_PREFIX = "PNP-SLR-";
const SEQ_PAD = 8;

/**
 * Build a Code128-safe immutable barcode identity.
 * Format: PNP-ADM-XXXXXXXX or PNP-SLR-XXXXXXXX
 */
function formatBarcodeValue(prefix, sequence) {
  const padded = String(sequence).padStart(SEQ_PAD, "0");
  return `${prefix}${padded}`;
}

/**
 * Generate a unique admin master barcode identity.
 * @returns {Promise<{ barcodeId: string, barcodeValue: string }>}
 */
export async function generateAdminBarcodeIdentity(session = null) {
  const seq = await getNextSequenceValue("barcode_admin", session);
  const barcodeValue = formatBarcodeValue(ADMIN_PREFIX, seq);
  return {
    barcodeId: barcodeValue,
    barcodeValue,
  };
}

/**
 * Generate a unique seller-specific barcode identity.
 * @returns {Promise<{ sellerBarcodeId: string, sellerBarcodeValue: string }>}
 */
export async function generateSellerBarcodeIdentity(session = null) {
  const seq = await getNextSequenceValue("barcode_seller", session);
  const barcodeValue = formatBarcodeValue(SELLER_PREFIX, seq);
  return {
    sellerBarcodeId: barcodeValue,
    sellerBarcodeValue: barcodeValue,
  };
}

export const BARCODE_PREFIXES = {
  ADMIN: ADMIN_PREFIX,
  SELLER: SELLER_PREFIX,
};
