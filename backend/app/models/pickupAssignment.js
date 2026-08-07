import mongoose from "mongoose";

const pickupAssignmentSchema = new mongoose.Schema(
  {
    purchaseRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseRequest",
      required: true,
      index: true,
    },
    requestId: {
      type: String,
      required: true,
      index: true,
    },
    hubId: {
      type: String,
      default: "MAIN_HUB",
    },
    status: {
      type: String,
      enum: ["broadcasting", "assigned", "superseded", "timeout", "cancelled"],
      default: "broadcasting",
    },
    winnerPickupPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PickupPartner",
    },
    attempt: {
      type: Number,
      default: 1,
    },
    expiresAt: Date,
    candidateIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PickupPartner",
      },
    ],
    meta: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

pickupAssignmentSchema.index({ requestId: 1, createdAt: -1 });

export default mongoose.model("PickupAssignment", pickupAssignmentSchema);
