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

// Auto-prune dead letters after a retention window — the failure detail here
// is for debugging/audit only; keep longer than the outbox since there's no
// other record of why a notification failed once this expires.
const DEADLETTER_RETENTION_SECONDS =
  Number(process.env.NOTIFICATION_DEADLETTER_RETENTION_DAYS || 90) * 24 * 60 * 60;

notificationDeadLetterSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: DEADLETTER_RETENTION_SECONDS },
);

export default mongoose.model("NotificationDeadLetter", notificationDeadLetterSchema);

