import mongoose from "mongoose";

/**
 * DeliverySettings (singleton document)
 *
 * Global configuration for the Delivery Mode feature (Express vs Slot delivery).
 * Fully controlled from the Admin Panel. A single document (singletonKey: "global")
 * is lazily created on first read so no seeding/migration is required.
 */

export const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// availableDays: admin can disable any weekday completely for slot delivery
const availableDaysShape = DAY_KEYS.reduce((shape, day) => {
  shape[day] = { type: Boolean, default: true };
  return shape;
}, {});

const deliverySettingsSchema = new mongoose.Schema(
  {
    // Enforces a single global settings document
    singletonKey: {
      type: String,
      default: "global",
      unique: true,
      immutable: true,
    },

    // Express delivery configuration
    expressEnabled: { type: Boolean, default: true },
    expressMinTime: { type: Number, default: 30, min: 1 }, // minutes
    expressMaxTime: { type: Number, default: 60, min: 1 }, // minutes
    expressTitle: { type: String, default: "Express Delivery", trim: true },

    // Slot delivery configuration
    slotEnabled: { type: Boolean, default: true },
    slotTitle: { type: String, default: "Slot Delivery", trim: true },

    // Weekday availability for slot delivery
    availableDays: availableDaysShape,
  },
  { timestamps: true },
);

/**
 * Fetch (or lazily create) the single global settings document.
 */
deliverySettingsSchema.statics.getSingleton = async function () {
  return this.findOneAndUpdate(
    { singletonKey: "global" },
    { $setOnInsert: { singletonKey: "global" } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

export default mongoose.model("DeliverySettings", deliverySettingsSchema);
