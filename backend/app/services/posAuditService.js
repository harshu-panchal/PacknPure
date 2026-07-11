import PosAuditLog from "../models/posAuditLog.js";

/**
 * Logs a POS cashier action for auditing purposes.
 * 
 * @param {Object} params
 * @param {String} params.action The action taken (e.g., 'VOID_BILL', 'MANUAL_DISCOUNT')
 * @param {String} params.cashierId The ID of the cashier/admin
 * @param {String} [params.sessionId] The current POS session ID
 * @param {String} [params.orderId] The associated order ID
 * @param {Object} [params.details] Any additional JSON details
 * @param {Object} [session] Optional MongoDB session for transaction support
 */
export const logPosAction = async ({ action, cashierId, sessionId, orderId, details }, session = null) => {
  try {
    const logEntry = new PosAuditLog({
      action,
      cashierId,
      sessionId,
      orderId,
      details
    });

    if (session) {
      await logEntry.save({ session });
    } else {
      await logEntry.save();
    }
  } catch (error) {
    console.error("[POS_AUDIT] Failed to log POS action:", error.message, { action, cashierId });
    // We intentionally don't throw to prevent blocking the main flow unless strictly required.
  }
};
