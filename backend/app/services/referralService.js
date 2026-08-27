import Customer from "../models/customer.js";
import Referral from "../models/referral.js";
import Transaction from "../models/transaction.js";
import Order from "../models/order.js";
import { getReferralSettings } from "./settingsService.js";

/**
 * Redeems a referral code for a brand-new customer at registration time.
 * Mutates `customer` in-memory (referredBy / referralCodeUsed / walletBalance /
 * referralSignupBonusGranted) — the caller is expected to persist it with a
 * single `customer.save()` alongside the rest of the profile-completion payload.
 * Creates the Referral + wallet Transaction records immediately (independent collections).
 *
 * Returns { applied: boolean, reason?: string, signupBonus?: number }.
 */
export async function redeemReferralCode(customer, rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { applied: false, reason: "empty" };

  if (customer.referredBy || customer.referralCodeUsed) {
    return { applied: false, reason: "already_used" };
  }

  const settings = await getReferralSettings();
  if (!settings.enabled) {
    return { applied: false, reason: "disabled" };
  }

  if (customer.referralCode && code === customer.referralCode) {
    return { applied: false, reason: "self" };
  }

  const referrer = await Customer.findOne({ referralCode: code }).select(
    "_id referralCode referralMaxAllowed",
  );
  if (!referrer) {
    return { applied: false, reason: "invalid" };
  }
  if (String(referrer._id) === String(customer._id)) {
    return { applied: false, reason: "self" };
  }

  const existing = await Referral.findOne({ referee: customer._id }).select("_id");
  if (existing) {
    return { applied: false, reason: "already_used" };
  }

  // Admin-configured cap on how many people this referrer can refer (null = unlimited).
  if (referrer.referralMaxAllowed !== null && referrer.referralMaxAllowed !== undefined) {
    const referrerReferralCount = await Referral.countDocuments({
      referrer: referrer._id,
      status: { $in: ["pending", "completed"] },
    });
    if (referrerReferralCount >= referrer.referralMaxAllowed) {
      return { applied: false, reason: "limit_reached" };
    }
  }

  try {
    await Referral.create({
      referrer: referrer._id,
      referee: customer._id,
      referralCode: code,
      status: "pending",
      refereeSignupBonus: settings.signupBonus,
      referrerBonus: settings.referrerBonus,
      minOrderValueRequired: settings.minOrderValue,
    });
  } catch (err) {
    // Unique index on `referee` — a concurrent request already redeemed a code for this account.
    if (err?.code === 11000) {
      return { applied: false, reason: "already_used" };
    }
    throw err;
  }

  customer.referredBy = referrer._id;
  customer.referralCodeUsed = code;

  if (settings.signupBonus > 0) {
    customer.walletBalance = Number(customer.walletBalance || 0) + settings.signupBonus;
    customer.referralSignupBonusGranted = true;
    await Transaction.create({
      user: customer._id,
      userModel: "User",
      type: "Referral Signup Bonus",
      amount: Math.abs(settings.signupBonus),
      status: "Settled",
      reference: `REF-SIGNUP-${customer._id}-${Date.now()}`,
      meta: { referrerId: referrer._id, referralCode: code },
    });
  }

  return { applied: true, signupBonus: settings.signupBonus };
}

/**
 * Releases the referrer's bonus the moment a referred customer's FIRST order
 * qualifies (meets the admin-defined minimum order value). Safe to call on
 * every order placement — no-ops for customers without a pending referral
 * and is naturally one-shot because it only ever fires on order #1.
 * Never throws for "no-op" cases; callers should still wrap in try/catch
 * since it touches the DB and must never block order placement.
 */
export async function processReferralOnFirstOrder(customer, order, orderTotal) {
  if (!customer?.referredBy) return;

  const settings = await getReferralSettings();
  if (!settings.enabled) return;

  const referral = await Referral.findOne({ referee: customer._id, status: "pending" });
  if (!referral) return;

  const priorOrderCount = await Order.countDocuments({
    customer: customer._id,
    _id: { $ne: order._id },
  });
  if (priorOrderCount > 0) return; // Not the referee's first order — bonus window already passed.

  const total = Number(orderTotal || 0);
  if (total < Number(referral.minOrderValueRequired || 0)) {
    await Referral.findOneAndUpdate(
      { _id: referral._id, status: "pending" },
      { $set: { status: "not_qualified", qualifyingOrder: order._id } },
    );
    return;
  }

  // Atomically claim the "pending -> completed" transition so a race (e.g. a retried
  // request) can never credit the referrer twice for the same referral.
  const claimed = await Referral.findOneAndUpdate(
    { _id: referral._id, status: "pending" },
    { $set: { status: "completed", qualifyingOrder: order._id, completedAt: new Date() } },
    { new: true },
  );
  if (!claimed) return;

  if (claimed.referrerBonus > 0) {
    await Customer.findByIdAndUpdate(claimed.referrer, {
      $inc: { walletBalance: claimed.referrerBonus },
    });
    const tx = await Transaction.create({
      user: claimed.referrer,
      userModel: "User",
      type: "Referral Bonus",
      amount: Math.abs(claimed.referrerBonus),
      status: "Settled",
      reference: `REF-BONUS-${claimed._id}`,
      order: order._id,
      meta: { refereeId: customer._id, referralId: claimed._id },
    });
    claimed.referrerBonusTxn = tx._id;
    await claimed.save();
  }
}
