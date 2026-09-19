import { getNextSequenceValue } from "./posSequenceService.js";

/**
 * Single shared sequence name — every order source draws from the same
 * counter, so numbers are globally sequential regardless of prefix.
 */
const GLOBAL_ORDER_SEQUENCE = "global_order_number";
const UNIFIED_ORDER_PREFIX = "PNP-ORD";

const ORDER_NUMBER_PREFIXES = {
  hub: UNIFIED_ORDER_PREFIX,
  seller: UNIFIED_ORDER_PREFIX,
  pos: UNIFIED_ORDER_PREFIX,
  online: UNIFIED_ORDER_PREFIX,
};

export const ORDER_NUMBER_SOURCES = Object.freeze(Object.keys(ORDER_NUMBER_PREFIXES));

/**
 * Format hub fulfillment sub-identifier from master order number.
 * e.g. "PNP-ORD0001" -> "PNP-ORD0001-HUB"
 */
export const formatHubFulfillmentCode = (displayOrderNumber) => {
  if (!displayOrderNumber) return "";
  return `${displayOrderNumber}-HUB`;
};

/**
 * Format seller fulfillment sub-identifier from master order number.
 * e.g. ("PNP-ORD0001", 1) -> "PNP-ORD0001-S1"
 */
export const formatSellerFulfillmentCode = (displayOrderNumber, sellerIndex = 1) => {
  if (!displayOrderNumber) return "";
  return `${displayOrderNumber}-S${sellerIndex}`;
};

/**
 * Atomically claims the next value from the single global order sequence and
 * formats it with the unified "PNP-ORD" prefix (e.g. PNP-ORD0001).
 * Pass the active mongoose session so the counter increment is part of the
 * same transaction as the order it's being generated for.
 */
export const generateOrderNumber = async (source = "hub", session = null) => {
  const sequenceNumber = await getNextSequenceValue(GLOBAL_ORDER_SEQUENCE, session);
  const displayOrderNumber = `${UNIFIED_ORDER_PREFIX}${String(sequenceNumber).padStart(4, "0")}`;

  return { displayOrderNumber, sequenceNumber, orderNumberSource: source };
};
