import mongoose from "mongoose";

const posSessionSchema = new mongoose.Schema(
  {
    terminalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PosTerminal",
      required: true,
    },
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
    },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
    },
    openedAt: {
      type: Date,
      default: Date.now,
    },
    closedAt: {
      type: Date,
    },
    openingCash: {
      type: Number,
      default: 0,
    },
    expectedCash: {
      type: Number,
      default: 0,
    },
    actualCash: {
      type: Number,
      default: 0,
    },
    cashDifference: {
      type: Number,
      default: 0,
    },
    totalCashSales: {
      type: Number,
      default: 0,
    },
    totalOnlineSales: {
      type: Number,
      default: 0,
    },
    totalCardSales: {
      type: Number,
      default: 0,
    },
    totalUPISales: {
      type: Number,
      default: 0,
    },
    totalRefunds: {
      type: Number,
      default: 0,
    },
    totalDiscount: {
      type: Number,
      default: 0,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

posSessionSchema.index({ terminalId: 1, status: 1 });
posSessionSchema.index({ cashierId: 1, status: 1 });

export default mongoose.model("PosSession", posSessionSchema);
