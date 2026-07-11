import Notification from "../models/notification.js";
import NotificationOutbox from "../models/notificationOutbox.js";
import {
  buildNotificationPayload,
} from "./notificationPayloadBuilder.js";
import {
  enqueueNotificationJobs,
} from "../queues/notificationQueues.js";
import {
  ensureObjectId,
  resolveRecipientsFromAudience,
} from "./notificationHelper.js";
import {
  getNotificationCategoryFromType,
  NOTIFICATION_CHANNELS,
} from "./notificationTypes.js";

const persistNotifications = async (records) => {
  if (!records.length) return [];
  return Notification.insertMany(records, { ordered: false });
};

const persistOutboxRecords = async (records) => {
  if (!records.length) return [];
  return NotificationOutbox.insertMany(records, { ordered: false });
};

export const createNotificationBatch = async (items = [], options = {}) => {
  try {
    const normalizedItems = (Array.isArray(items) ? items : [])
      .map((item) => {
        const recipient = ensureObjectId(item?.recipient);
        if (!recipient || !item?.recipientModel) return null;
        const payload = buildNotificationPayload({
          ...options,
          ...item,
          recipient,
          recipientModel: item.recipientModel,
          type: item.type || options.type,
          category: item.category || options.category || getNotificationCategoryFromType(item.type || options.type),
          channel: item.channel || options.channel || NOTIFICATION_CHANNELS.BOTH,
        });
        return payload;
      })
      .filter(Boolean);

    if (!normalizedItems.length) return [];

    const notifications = await persistNotifications(
      normalizedItems.map((item) => ({
        eventId: item.eventId,
        recipient: item.recipient,
        recipientModel: item.recipientModel,
        sender: item.sender || null,
        senderModel: item.senderModel || null,
        title: item.title,
        message: item.message,
        type: item.type,
        category: item.category,
        channel: item.channel,
        priority: item.priority,
        deepLink: item.deepLink,
        imageUrl: item.imageUrl,
        audience: item.audience,
        broadcastBatchId: item.broadcastBatchId || "",
        hash: item.hash,
        deliveryStatus: item.channel === NOTIFICATION_CHANNELS.IN_APP ? "skipped" : "queued",
        data: item.data,
        attemptCount: 0,
      })),
    );

    const outboxRecords = normalizedItems.map((item, index) => ({
      eventId: item.eventId,
      hash: item.hash,
      notification: notifications[index]._id,
      recipient: item.recipient,
      recipientModel: item.recipientModel,
      notificationType: item.type,
      category: item.category,
      channel: item.channel,
      priority: item.priority,
      status: item.channel === NOTIFICATION_CHANNELS.IN_APP ? "skipped" : "queued",
      attempts: 0,
      maxAttempts: Number(options.maxAttempts || 5),
      payload: {
        notificationId: notifications[index]._id.toString(),
        recipientId: item.recipient.toString(),
        recipientModel: item.recipientModel,
        eventId: item.eventId,
        hash: item.hash,
      },
      lastError: "",
    }));

    const outboxDocs = await persistOutboxRecords(outboxRecords);

    const jobs = outboxDocs
      .map((doc, index) => ({ doc, index }))
      .filter(({ doc }) => doc.status === "queued")
      .map(({ doc, index }) => ({
        outboxId: doc._id.toString(),
        notificationId: notifications[index]?._id?.toString(),
        recipient: normalizedItems[index].recipient.toString(),
        recipientModel: normalizedItems[index].recipientModel,
        eventId: normalizedItems[index].eventId,
        hash: normalizedItems[index].hash,
        notificationType: normalizedItems[index].type,
        category: normalizedItems[index].category,
        channel: normalizedItems[index].channel,
        priority: normalizedItems[index].priority,
        payload: doc.payload,
      }));

    if (jobs.length) {
      try {
        await enqueueNotificationJobs(jobs);
      } catch (queueError) {
        console.warn("[notificationService] enqueue failed:", queueError.message);
      }
    }

    return notifications;
  } catch (error) {
    console.warn("[notificationService] createNotificationBatch failed:", error.message);
    return [];
  }
};

export const createNotification = async (input = {}) =>
  (await createNotificationBatch([input], input))[0] || null;

export const broadcastNotification = async ({
  targetRole = "all",
  recipientIds = [],
  recipientModel = null,
  includePickupPartner = true,
  ...notification
} = {}) => {
  const recipients = await resolveRecipientsFromAudience({
    targetRole,
    recipientIds,
    recipientModel,
    includePickupPartner,
  });

  if (!recipients.length) return [];

  return createNotificationBatch(
    recipients.map((recipient) => ({
      ...notification,
      recipient: recipient.recipient,
      recipientModel: recipient.recipientModel,
      category: notification.category || getNotificationCategoryFromType(notification.type || "system"),
      type: notification.type || "system",
    })),
    notification,
  );
};
