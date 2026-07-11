import mongoose from "mongoose";

const posIdempotencySchema = new mongoose.Schema(
  {
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    requestPath: {
      type: String,
      required: true,
    },
    requestBodyHash: {
      type: String, // To ensure the payload hasn't changed
    },
    responseStatus: {
      type: Number,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
    },
    expiresAt: {
      type: Date,
      default: () => Date.now() + 24 * 60 * 60 * 1000, // Expires after 24 hours
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model("PosIdempotency", posIdempotencySchema);
