import mongoose from "mongoose";

const posAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        "LOGIN",
        "OPEN_SESSION",
        "CLOSE_SESSION",
        "MANUAL_DISCOUNT",
        "VOID_BILL",
        "CANCEL_BILL",
        "REFUND",
        "PRINT_RECEIPT",
        "REPRINT",
      ],
      required: true,
      index: true,
    },
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PosSession",
      index: true,
    },
    orderId: {
      type: String, // Optional reference to Order.orderId
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed, // e.g., { discountAmount: 100, reason: "damaged box" }
    },
  },
  { timestamps: true }
);

export default mongoose.model("PosAuditLog", posAuditLogSchema);
