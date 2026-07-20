import mongoose from "mongoose";

const rollbackRecordSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    rollbackEvent: {
      type: String,
      enum: [
        "ORDER_CANCELLED",
        "PROCUREMENT_FAILED",
        "SELLER_REJECTED",
        "SELLER_TIMEOUT",
        "QA_REJECTED",
        "PAYMENT_FAILED",
        "ORDER_EXPIRED",
        "SYSTEM_COMPENSATION",
      ],
      required: true,
      index: true,
    },
    reason: { type: String, default: "" },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    procurementSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "ProcurementSession", index: true },
    purchaseRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseRequest", index: true },
    allocationId: { type: String, index: true },
    actorId: { type: String, default: null },
    actorType: { type: String, default: "system" },
    status: {
      type: String,
      enum: ["started", "completed", "skipped", "failed"],
      default: "started",
      index: true,
    },
    operations: [
      {
        action: String,
        productId: String,
        variantId: String,
        sellerProductId: String,
        quantity: Number,
        result: mongoose.Schema.Types.Mixed,
      },
    ],
    beforeState: { type: mongoose.Schema.Types.Mixed, default: {} },
    afterState: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: "" },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

rollbackRecordSchema.index(
  { rollbackEvent: 1, orderId: 1, allocationId: 1, purchaseRequestId: 1 },
  { sparse: true },
);

export default mongoose.model("RollbackRecord", rollbackRecordSchema);
