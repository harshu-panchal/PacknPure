import mongoose from "mongoose";
import { DAY_KEYS } from "./deliverySettings.js";

/**
 * DeliverySlot
 *
 * A single admin-configurable delivery time window (e.g. 09:00 - 12:00).
 * - `day` = "all" applies the slot to every enabled weekday, or it can be
 *   restricted to one specific weekday.
 * - `displayOrder` drives the ordering shown in both admin panel and user app.
 * Times are stored as 24h "HH:MM" strings and formatted on the client.
 */
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const deliverySlotSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ["all", ...DAY_KEYS],
      default: "all",
    },
    startTime: {
      type: String,
      required: true,
      match: [TIME_REGEX, "startTime must be in 24h HH:MM format"],
    },
    endTime: {
      type: String,
      required: true,
      match: [TIME_REGEX, "endTime must be in 24h HH:MM format"],
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

deliverySlotSchema.index({ displayOrder: 1 });
deliverySlotSchema.index({ enabled: 1, day: 1 });

export { TIME_REGEX };
export default mongoose.model("DeliverySlot", deliverySlotSchema);
