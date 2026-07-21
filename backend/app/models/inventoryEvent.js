import mongoose from "mongoose";

/**
 * Append-only ledger for inventory mutations.
 * Every Inventory Engine write must record an event keyed by idempotencyKey.
 */
const inventoryEventSchema = new mongoose.Schema(
  {
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    action: { type: String, required: true, index: true },
    productId: { type: String, default: null, index: true },
    variantId: { type: String, default: null },
    hubId: { type: String, default: null },
    sellerId: { type: String, default: null },
    orderId: { type: String, default: null, index: true },
    purchaseRequestId: { type: String, default: null, index: true },
    allocationId: { type: String, default: null, index: true },
    quantity: { type: Number, default: 0 },
    applied: { type: Boolean, default: false },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
    reason: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model("InventoryEvent", inventoryEventSchema);
