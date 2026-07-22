import mongoose from "mongoose";

const gpsSnapshotSchema = new mongoose.Schema(
  {
    lat: Number,
    lng: Number,
    accuracy: Number,
    heading: Number,
    speed: Number,
  },
  { _id: false },
);

const deliveryAuditSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    orderRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    deliveryBoy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
    },
    event: {
      type: String,
      enum: [
        "assigned",
        "reached_hub",
        "picked",
        "out_for_delivery",
        "nearby",
        "reached_customer",
        "otp_verified",
        "delivered",
        "gps_snapshot",
        "masked_call_initiated",
      ],
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    gpsSnapshot: gpsSnapshotSchema,
    durationMs: Number,
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false },
);

deliveryAuditSchema.index({ orderId: 1, event: 1, createdAt: -1 });

export default mongoose.model("DeliveryAudit", deliveryAuditSchema);
