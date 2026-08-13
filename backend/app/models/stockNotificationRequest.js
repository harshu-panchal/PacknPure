import mongoose from "mongoose";

const stockNotificationRequestSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    notified: {
      type: Boolean,
      default: false,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// One pending subscription per customer+product+variant.
stockNotificationRequestSchema.index(
  { customerId: 1, productId: 1, variantId: 1 },
  { unique: true },
);
stockNotificationRequestSchema.index({ productId: 1, notified: 1 });

export default mongoose.model(
  "StockNotificationRequest",
  stockNotificationRequestSchema,
);
