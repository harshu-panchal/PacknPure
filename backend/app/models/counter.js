import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g., 'receipt_number', 'invoice_number'
  sequence_value: { type: Number, default: 0 }
});

export default mongoose.model("Counter", counterSchema);
