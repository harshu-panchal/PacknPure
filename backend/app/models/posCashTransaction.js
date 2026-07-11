import mongoose from "mongoose";

const posCashTransactionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PosSession",
      required: true,
      index: true,
    },
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    type: {
      type: String,
      enum: ["OPENING", "SALES", "REFUND", "DEPOSIT", "WITHDRAWAL", "CLOSING"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    remarks: {
      type: String,
    },
    orderId: {
      type: String, // Optional, for tracking SALE/REFUND back to a specific order
    },
  },
  { timestamps: true }
);

export default mongoose.model("PosCashTransaction", posCashTransactionSchema);
