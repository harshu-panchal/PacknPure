import mongoose from "mongoose";

const notificationOutboxSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    hash: {
      type: String,
      required: true,
      trim: true,
    },
    notification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    recipientModel: {
      type: String,
      required: true,
      enum: ["Seller", "Admin", "Customer", "Delivery", "PickupPartner"],
      index: true,
    },
    notificationType: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      default: "system",
      index: true,
    },
    channel: {
      type: String,
      enum: ["in_app", "push", "both"],
      default: "both",
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "sent", "failed", "dead_letter", "skipped"],
      default: "queued",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastError: {
      type: String,
      default: "",
    },
    lockedAt: {
      type: Date,
    },
    sentAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    nextRetryAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

notificationOutboxSchema.index(
  { eventId: 1, recipient: 1, notificationType: 1, hash: 1 },
  { unique: true },
);

export default mongoose.model("NotificationOutbox", notificationOutboxSchema);

