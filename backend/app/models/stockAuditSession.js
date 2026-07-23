import mongoose from "mongoose";

/**
 * Physical stock audit session.
 * READ-ONLY vs live inventory: lines snapshot expectedQty at first scan.
 * Never writes inventory / POS / orders. Future approval can apply diffs later.
 */
const auditLineSchema = new mongoose.Schema(
  {
    barcodeValue: { type: String, required: true, trim: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    productName: { type: String, default: "" },
    variantName: { type: String, default: "" },
    unit: { type: String, default: "" },
    /** Snapshot of system stock at first scan — never auto-updated afterward. */
    expectedQty: { type: Number, default: 0, min: 0 },
    countedQty: { type: Number, default: 0, min: 0 },
    firstScannedAt: { type: Date, default: Date.now },
    lastScannedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const stockAuditSessionSchema = new mongoose.Schema(
  {
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    /** Where the physical count happens. */
    locationType: {
      type: String,
      enum: ["hub", "warehouse", "seller_store"],
      required: true,
    },
    locationLabel: { type: String, default: "", trim: true },
    hubId: { type: String, default: "MAIN_HUB", trim: true },
    /** Set for seller_store audits (and seller-created sessions). */
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      default: null,
    },
    status: {
      type: String,
      enum: ["draft", "in_progress", "paused", "completed", "cancelled"],
      default: "draft",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    createdByRole: {
      type: String,
      enum: ["admin", "seller"],
      required: true,
    },
    notes: { type: String, default: "", trim: true },
    startedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    lines: { type: [auditLineSchema], default: [] },
    /**
     * Future-ready: manager approval before applying stock adjustments.
     * Current phase never applies inventory changes.
     */
    approval: {
      status: {
        type: String,
        enum: ["not_required", "pending", "approved", "rejected"],
        default: "not_required",
      },
      appliedToInventory: { type: Boolean, default: false },
      decidedAt: { type: Date, default: null },
      decidedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
      note: { type: String, default: null },
    },
  },
  { timestamps: true },
);

stockAuditSessionSchema.index({ status: 1, createdAt: -1 });
stockAuditSessionSchema.index({ createdByRole: 1, createdBy: 1, createdAt: -1 });
stockAuditSessionSchema.index({ sellerId: 1, createdAt: -1 });
stockAuditSessionSchema.index({ locationType: 1, status: 1 });
stockAuditSessionSchema.index({ "lines.barcodeValue": 1 });

stockAuditSessionSchema.methods.computeLineStatus = function computeLineStatus(line) {
  const expected = Math.max(0, Number(line.expectedQty) || 0);
  const counted = Math.max(0, Number(line.countedQty) || 0);
  const difference = counted - expected;
  let status = "matched";
  if (difference < 0) status = "short";
  else if (difference > 0) status = "over";
  return { expected, counted, difference, status };
};

stockAuditSessionSchema.methods.buildSummary = function buildSummary() {
  const lines = Array.isArray(this.lines) ? this.lines : [];
  let matched = 0;
  let short = 0;
  let over = 0;
  let totalExpected = 0;
  let totalCounted = 0;

  for (const line of lines) {
    const row = this.computeLineStatus(line);
    totalExpected += row.expected;
    totalCounted += row.counted;
    if (row.status === "matched") matched += 1;
    else if (row.status === "short") short += 1;
    else over += 1;
  }

  return {
    totalSkus: lines.length,
    matched,
    short,
    over,
    totalExpected,
    totalCounted,
    totalDifference: totalCounted - totalExpected,
  };
};

export default mongoose.model("StockAuditSession", stockAuditSessionSchema);
