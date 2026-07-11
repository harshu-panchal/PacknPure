import Counter from "../models/counter.js";

/**
 * Generates an atomic sequence number for a given sequence name.
 * Uses findOneAndUpdate with upsert and $inc to guarantee atomicity.
 * 
 * @param {String} sequenceName The name of the sequence (e.g., 'receipt_number')
 * @param {Object} session Optional MongoDB session for transaction support
 * @returns {Number} The newly generated sequence value
 */
export const getNextSequenceValue = async (sequenceName, session = null) => {
  const options = { returnDocument: 'after', upsert: true };
  if (session) {
    options.session = session;
  }

  const sequenceDocument = await Counter.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { sequence_value: 1 } },
    options
  );

  return sequenceDocument.sequence_value;
};

/**
 * Generates a formatted receipt number.
 * e.g. RCPT100001
 */
export const generateReceiptNumber = async (session = null) => {
  const seq = await getNextSequenceValue("receipt_number", session);
  return `RCPT${100000 + seq}`; // Start from RCPT100001
};

/**
 * Generates a formatted GST invoice number.
 * e.g. INV-2026-000001
 */
export const generateInvoiceNumber = async (session = null) => {
  const currentYear = new Date().getFullYear();
  // Sequence resets per year, e.g., 'invoice_number_2026'
  const seq = await getNextSequenceValue(`invoice_number_${currentYear}`, session);
  
  // Pad the sequence with leading zeros (e.g., 000001)
  const paddedSeq = String(seq).padStart(6, '0');
  
  return `INV-${currentYear}-${paddedSeq}`;
};
