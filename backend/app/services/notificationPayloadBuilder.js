import crypto from "crypto";
import { getNotificationCategoryFromType } from "./notificationTypes.js";

function toPlainValue(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toPlainValue);
  if (typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = toPlainValue(child);
    }
    return out;
  }
  return value;
}

export const buildNotificationEventId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const buildNotificationHash = ({
  eventId,
  recipient,
  recipientModel,
  type,
  title,
  message,
  data,
}) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        eventId,
        recipient: String(recipient || ""),
        recipientModel: String(recipientModel || ""),
        type: String(type || ""),
        title: String(title || ""),
        message: String(message || ""),
        data: toPlainValue(data || {}),
      }),
    )
    .digest("hex");

export const buildNotificationPayload = (input = {}) => {
  const eventId = input.eventId || buildNotificationEventId();
  const category = input.category || getNotificationCategoryFromType(input.type);
  const payload = {
    eventId,
    recipient: input.recipient,
    recipientModel: input.recipientModel,
    sender: input.sender || null,
    senderModel: input.senderModel || null,
    title: String(input.title || "Notification"),
    message: String(input.message || ""),
    type: String(input.type || "alert"),
    category,
    channel: input.channel || "both",
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
    deepLink: String(input.deepLink || ""),
    imageUrl: String(input.imageUrl || ""),
    broadcastBatchId: input.broadcastBatchId || "",
    audience: input.audience || {},
    data: toPlainValue(input.data || {}),
  };

  payload.hash = input.hash || buildNotificationHash(payload);
  return payload;
};

export const normalizeNotificationDataForPush = (data = {}) => {
  const normalized = {};
  for (const [key, value] of Object.entries(toPlainValue(data))) {
    if (value == null) continue;
    normalized[String(key)] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return normalized;
};

