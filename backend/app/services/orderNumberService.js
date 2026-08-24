import { getNextSequenceValue } from "./posSequenceService.js";

/**
 * Single shared sequence name — every order source draws from the same
 * counter, so numbers are globally sequential regardless of prefix.
 */
const GLOBAL_ORDER_SEQUENCE = "global_order_number";

const ORDER_NUMBER_PREFIXES = {
  hub: "HUBORD",
  seller: "SLRORD",
  pos: "POSORD",
};

export const ORDER_NUMBER_SOURCES = Object.freeze(Object.keys(ORDER_NUMBER_PREFIXES));

/**
 * Atomically claims the next value from the single global order sequence and
 * formats it with the prefix for the given source (hub/seller/pos).
 * Pass the active mongoose session so the counter increment is part of the
 * same transaction as the order it's being generated for.
 */
export const generateOrderNumber = async (source, session = null) => {
  const prefix = ORDER_NUMBER_PREFIXES[source];
  if (!prefix) {
    throw new Error(`Invalid order source "${source}" for order number generation`);
  }

  const sequenceNumber = await getNextSequenceValue(GLOBAL_ORDER_SEQUENCE, session);
  const displayOrderNumber = `${prefix}${String(sequenceNumber).padStart(4, "0")}`;

  return { displayOrderNumber, sequenceNumber, orderNumberSource: source };
};
