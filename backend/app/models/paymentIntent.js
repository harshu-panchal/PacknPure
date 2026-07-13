import mongoose from "mongoose";

const paymentIntentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["created", "processing", "completed", "failed", "cancelled"],
      default: "created",
    },
    amount: { type: Number, required: true }, // final amount (INR)
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    // Snapshot of user-provided checkout data (items, address, coupon, wallet, deliverySlot)
    checkout: {
      type: Object,
    },
    meta: { type: Object },
  },
  { timestamps: true },
);

paymentIntentSchema.index({ razorpayPaymentId: 1 }, { unique: false });

export default mongoose.model("PaymentIntent", paymentIntentSchema);
