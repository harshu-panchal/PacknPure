import mongoose from "mongoose";

// A single rider's batched delivery run for orders that share a hub + slot.
// Order.deliveryBoy is still set (same rider) on every order in the trip so
// all existing single-order screens/queries keep working unchanged — this
// model only adds the nearest-first stop sequencing on top.
const deliveryTripStopSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    orderCode: {
      type: String,
      required: true,
    },
    sequence: {
      type: Number,
      required: true,
    },
    lat: Number,
    lng: Number,
    status: {
      type: String,
      enum: ["pending", "delivered", "failed"],
      default: "pending",
    },
    deliveredAt: Date,
  },
  { _id: false },
);

const deliveryTripSchema = new mongoose.Schema(
  {
    tripId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deliveryBoy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
      required: true,
      index: true,
    },
    hubId: {
      type: String,
      required: true,
    },
    selectedDate: {
      type: String,
      required: true,
    },
    selectedSlot: {
      type: String,
      required: true,
    },
    stops: {
      type: [deliveryTripStopSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
      index: true,
    },
    currentStopSequence: {
      type: Number,
      default: 1,
    },
    // Set the moment the rider taps "Reached Hub" and every stop's order is
    // moved to OUT_FOR_DELIVERY in one shot — one hub visit for the whole trip.
    hubReachedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

deliveryTripSchema.index({ deliveryBoy: 1, status: 1 });

export default mongoose.model("DeliveryTrip", deliveryTripSchema);
