import mongoose from "mongoose";

const paymentIntentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["created", "processing", "completed", "failed", "cancelled"],
      default: "created",
    },
    amount: { type: Number, required: true }, // final amount (INR) - VALIDATED SERVER-SIDE
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String, unique: true, sparse: true }, // Unique for idempotency
    razorpaySignature: { type: String },
    
    // === CRITICAL: Server-side snapshot for idempotency and revalidation ===
    // Cart snapshot with validated items and prices
    cartSnapshot: {
      items: [
        {
          productId: mongoose.Schema.Types.ObjectId,
          quantity: Number,
          variantId: mongoose.Schema.Types.ObjectId,
          productName: String,
          price: Number, // Unit price at intent creation
          purchasePrice: Number,
        },
      ],
    },
    
    // === Pricing breakdown (calculated server-side) ===
    pricingBreakdown: {
      subtotal: Number,
      itemGst: Number, // GST on items
      couponDiscount: Number,
      couponCode: String,
      walletUsed: Number,
      deliveryFee: Number,
      platformFee: Number,
      total: Number,
      pricingVersion: String, // Hash to detect stale pricing
    },
    
    // === Coupon details ===
    coupon: {
      id: mongoose.Schema.Types.ObjectId,
      code: String,
      discountType: String,
      discountValue: Number,
      maxDiscount: Number,
    },
    
    // === Address & delivery ===
    address: {
      addressId: mongoose.Schema.Types.ObjectId,
      full: String,
      lat: Number,
      lng: Number,
      city: String,
    },
    
    deliverySlot: {
      date: String,
      time: String,
    },

    // === Delivery Mode feature (Express / Slot) — additive only ===
    deliveryMode: { type: String, enum: ["EXPRESS", "SLOT"], default: "EXPRESS" },
    selectedSlot: { type: String, default: null }, // e.g. "09:00-12:00"
    selectedDate: { type: String, default: null }, // e.g. "2026-07-20"
    
    // === Wallet ===
    walletBalance: Number,
    walletUsed: Number,
    
    // === Audit ===
    checkout: {
      type: Object, // Legacy: raw checkout for debugging
    },
    meta: { type: Object },
    
    // === Expiry & cleanup ===
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      index: { expireAfterSeconds: 0 }, // TTL index
    },
  },
  { timestamps: true },
);

paymentIntentSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });
paymentIntentSchema.index({ user: 1, createdAt: -1 });
paymentIntentSchema.index({ status: 1 });

export default mongoose.model("PaymentIntent", paymentIntentSchema);
