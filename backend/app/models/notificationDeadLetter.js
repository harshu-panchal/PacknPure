import mongoose from "mongoose";

const notificationDeadLetterSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      trim: true,
      index: true,
    },
    hash: {
      type: String,
      trim: true,
      index: true,
    },
    notification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      index: true,
    },
    outbox: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NotificationOutbox",
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
    reason: {
      type: String,
      default: "",
    },
    stack: {
      type: String,
      default: "",
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    replayCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

notificationDeadLetterSchema.index({ createdAt: -1 });

export default mongoose.model("NotificationDeadLetter", notificationDeadLetterSchema);

