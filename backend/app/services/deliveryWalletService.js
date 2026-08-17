import mongoose from "mongoose";
import Transaction from "../models/transaction.js";
import Delivery from "../models/delivery.js";

/**
 * Delivery partner wallet balances — derived entirely from the immutable
 * Transaction ledger (never a cached/stored number). Two wallets, kept
 * strictly separate so a partner can never withdraw admin's COD cash as if
 * it were their own earnings:
 *
 *  - Earnings Wallet: Delivery Earning + Incentive + Bonus (credits) minus Withdrawal (debits).
 *  - Cash Collection Wallet: Cash Collection (credits, admin's money held as a liability)
 *    minus Cash Settlement (debits, handed back to admin).
 */

const EARNINGS_CREDIT_TYPES = ["Delivery Earning", "Incentive", "Bonus"];
const CASH_WALLET_TYPES = ["Cash Collection", "Cash Settlement"];

/**
 * @param {boolean} includePending - also subtract Pending/Processing withdrawals.
 *   Use true when validating a NEW withdrawal request (so a partner can't
 *   request more than what isn't already reserved by an earlier request).
 *   Use false (default) to show the partner's actual current balance.
 */
export async function computeEarningsWalletBalance(deliveryBoyId, { includePending = false, session = null } = {}) {
  let query = Transaction.find({
    user: deliveryBoyId,
    userModel: "Delivery",
    type: { $in: [...EARNINGS_CREDIT_TYPES, "Withdrawal"] },
  }).select("type amount status");
  if (session) query = query.session(session);
  const transactions = await query.lean();

  const credited = transactions
    .filter((t) => t.status === "Settled" && EARNINGS_CREDIT_TYPES.includes(t.type))
    .reduce((acc, t) => acc + t.amount, 0);

  const withdrawalStatuses = includePending ? ["Settled", "Pending", "Processing"] : ["Settled"];
  const withdrawn = transactions
    .filter((t) => t.type === "Withdrawal" && withdrawalStatuses.includes(t.status))
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);

  return credited - withdrawn;
}

/**
 * @param {boolean} includePending - also subtract Pending/Processing Cash
 *   Settlements. Use true when validating a NEW remittance request.
 */
export async function computeCashWalletBalance(deliveryBoyId, { includePending = false, session = null } = {}) {
  let query = Transaction.find({
    user: deliveryBoyId,
    userModel: "Delivery",
    type: { $in: CASH_WALLET_TYPES },
  }).select("type amount status");
  if (session) query = query.session(session);
  const transactions = await query.lean();

  const settlementStatuses = includePending ? ["Settled", "Pending", "Processing"] : ["Settled"];

  return transactions.reduce((acc, t) => {
    if (t.type === "Cash Collection") {
      return t.status === "Settled" ? acc + t.amount : acc;
    }
    // Cash Settlement (debit)
    return settlementStatuses.includes(t.status) ? acc - Math.abs(t.amount) : acc;
  }, 0);
}

export async function computeTodayCashCollected(deliveryBoyId) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const result = await Transaction.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(String(deliveryBoyId)),
        userModel: "Delivery",
        type: "Cash Collection",
        status: "Settled",
        createdAt: { $gte: startOfToday },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return result[0]?.total || 0;
}

/**
 * Full wallet summary for the partner dashboard.
 */
export async function getDeliveryWalletSummary(deliveryBoyId) {
  const [earningsWallet, cashWallet, todayCashCollected, partner] = await Promise.all([
    computeEarningsWalletBalance(deliveryBoyId),
    computeCashWalletBalance(deliveryBoyId),
    computeTodayCashCollected(deliveryBoyId),
    Delivery.findById(deliveryBoyId).select("limit").lean(),
  ]);
  const cashLimit = partner?.limit ?? 5000;

  return {
    earningsWallet,
    cashWallet,
    todayCashCollected,
    cashLimit,
    cashLimitUsedPercent: cashLimit > 0 ? Math.min(100, Math.round((cashWallet / cashLimit) * 100)) : 0,
    isOverCashLimit: cashWallet >= cashLimit,
  };
}
