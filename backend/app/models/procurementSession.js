import mongoose from "mongoose";

const allocationSchema = new mongoose.Schema(
  {
    allocationId: { type: String, required: true },
    itemKey: { type: String, required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    quantity: { type: Number, required: true, min: 1 },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
    selectedSellerProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    retryNumber: { type: Number, default: 0 },
    sourceAllocationId: { type: String, default: null },
    purchaseRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseRequest", default: null },
    rankedSellers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Seller" }],
    status: {
      type: String,
      enum: ["allocated", "locked", "rejected", "timed_out", "completed", "failed", "cancelled"],
      default: "allocated",
      index: true,
    },
    reservationState: {
      type: String,
      enum: ["NOT_RESERVED", "RESERVED", "RELEASED", "COMPLETED"],
      default: "NOT_RESERVED",
      index: true,
    },
    reservedQty: { type: Number, default: 0, min: 0 },
    acceptedQty: { type: Number, default: 0, min: 0 },
    rejectedQty: { type: Number, default: 0, min: 0 },
    completedQty: { type: Number, default: 0, min: 0 },
    reason: { type: String, default: "" },
    eventKey: { type: String, default: null, index: true },
  },
  { _id: false, timestamps: true },
);

const sessionItemSchema = new mongoose.Schema(
  {
    itemKey: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    requiredQty: { type: Number, required: true, min: 1 },
    remainingQty: { type: Number, default: 0, min: 0 },
    allocatedQty: { type: Number, default: 0, min: 0 },
    acceptedQty: { type: Number, default: 0, min: 0 },
    rejectedQty: { type: Number, default: 0, min: 0 },
    completedQty: { type: Number, default: 0, min: 0 },
    failedQty: { type: Number, default: 0, min: 0 },
    retryCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const procurementSessionSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    hubId: { type: String, default: "MAIN_HUB", index: true },
    status: {
      type: String,
      enum: ["open", "completed", "failed", "on_hold", "cancelled"],
      default: "open",
      index: true,
    },
    retryCount: { type: Number, default: 0, min: 0 },
    items: { type: [sessionItemSchema], default: [] },
    allocations: { type: [allocationSchema], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

procurementSessionSchema.index({ "allocations.eventKey": 1 });
procurementSessionSchema.index({ "allocations.purchaseRequestId": 1 });

export default mongoose.model("ProcurementSession", procurementSessionSchema);
