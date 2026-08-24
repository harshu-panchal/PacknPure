import mongoose from "mongoose";

/**
 * One document per successful referral redemption (referee signup).
 * `referee` is unique — a customer can be referred at most once, ever,
 * which is the primary guard against duplicate/fraudulent redemptions.
 */
const referralSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    referralCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    // pending        -> referee signed up, referrer bonus not yet released
    // completed      -> referee's qualifying first order released the referrer bonus
    // not_qualified  -> referee placed their first (and only qualifying-chance) order, but it was below the minimum value
    // void           -> referral invalidated (e.g. referee account removed/blocked)
    status: {
      type: String,
      enum: ["pending", "completed", "not_qualified", "void"],
      default: "pending",
      index: true,
    },

    // Amounts are snapshotted at redemption/completion time so later admin
    // changes to the global settings never retroactively alter a past referral.
    refereeSignupBonus: { type: Number, default: 0, min: 0 },
    referrerBonus: { type: Number, default: 0, min: 0 },
    minOrderValueRequired: { type: Number, default: 0, min: 0 },

    refereeSignupBonusTxn: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    referrerBonusTxn: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },

    qualifyingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

referralSchema.index({ referrer: 1, createdAt: -1 });
referralSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Referral", referralSchema);
