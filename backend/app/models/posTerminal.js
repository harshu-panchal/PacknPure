import mongoose from "mongoose";

const posTerminalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    storeLocation: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deviceIdentifiers: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("PosTerminal", posTerminalSchema);
