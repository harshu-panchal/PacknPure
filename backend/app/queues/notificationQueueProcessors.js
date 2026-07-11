import Notification from "../models/notification.js";
import NotificationOutbox from "../models/notificationOutbox.js";
import NotificationDeadLetter from "../models/notificationDeadLetter.js";
import {
  getRecipientDocument,
  getRecipientPreferences,
  normalizeNotificationTokenList,
  removeRecipientPushToken,
} from "../services/notificationHelper.js";
import { notificationQueue } from "./notificationQueues.js";
import {
  sendFcmMulticast,
  sendFcmToToken,
} from "../services/firebaseService.js";
import {
  getNotificationCategoryFromType,
  isPushCategoryEnabled,
} from "../services/notificationTypes.js";
import { normalizeNotificationDataForPush } from "../services/notificationPayloadBuilder.js";

const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

const TRANSIENT_ERROR_CODES = new Set([
  "messaging/server-unavailable",
  "messaging/internal-error",
  "messaging/third-party-auth-error",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
]);

const isRetryableError = (error) => {
  const code = String(error?.code || error?.errorInfo?.code || error?.name || "").trim();
  if (!code) return true;
  if (INVALID_TOKEN_CODES.has(code)) return false;
  return TRANSIENT_ERROR_CODES.has(code) || code.startsWith("messaging/");
};

async function markDeadLetter(outbox, reason, error, payload) {
  const stack = error?.stack || "";
  await NotificationOutbox.findByIdAndUpdate(outbox._id, {
    $set: {
      status: "dead_letter",
      lastError: reason,
      failedAt: new Date(),
    },
  });

  await NotificationDeadLetter.create({
    eventId: outbox.eventId,
    hash: outbox.hash,
    notification: outbox.notification,
    outbox: outbox._id,
    recipient: outbox.recipient,
    recipientModel: outbox.recipientModel,
    notificationType: outbox.notificationType,
    category: outbox.category,
    reason,
    stack,
    payload: payload || outbox.payload || {},
  });
}

async function sendNotificationForOutbox(outboxDoc) {
  const notification = await Notification.findById(outboxDoc.notification).lean();
  if (!notification) {
    await NotificationOutbox.findByIdAndUpdate(outboxDoc._id, {
      $set: {
        status: "failed",
        lastError: "Notification record missing",
        failedAt: new Date(),
      },
    });
    return { skipped: true };
  }

  const recipientDoc = await getRecipientDocument({
    recipientId: outboxDoc.recipient,
    recipientModel: outboxDoc.recipientModel,
  });

  if (!recipientDoc) {
    await markDeadLetter(outboxDoc, "Recipient not found", new Error("Recipient not found"), outboxDoc.payload);
    return { skipped: true };
  }

  const preferences = getRecipientPreferences(recipientDoc, outboxDoc.recipientModel);
  const category = outboxDoc.category || getNotificationCategoryFromType(outboxDoc.notificationType);
  if (!isPushCategoryEnabled(preferences, category)) {
    await NotificationOutbox.findByIdAndUpdate(outboxDoc._id, {
      $set: {
        status: "skipped",
        lastError: "Recipient push preference disabled",
        sentAt: new Date(),
      },
    });
    await Notification.findByIdAndUpdate(notification._id, {
      $set: {
        deliveryStatus: "skipped",
        sentAt: new Date(),
      },
    });
    return { skipped: true };
  }

  const rawTokens = normalizeNotificationTokenList(recipientDoc.fcmTokens || []);
  const activeTokens = rawTokens.filter((record) => record.isActive !== false && record.token);
  if (!activeTokens.length) {
    await NotificationOutbox.findByIdAndUpdate(outboxDoc._id, {
      $set: {
        status: "skipped",
        lastError: "No active push tokens",
        sentAt: new Date(),
      },
    });
    await Notification.findByIdAndUpdate(notification._id, {
      $set: {
        deliveryStatus: "skipped",
        sentAt: new Date(),
      },
    });
    return { skipped: true };
  }

  const pushPayload = {
    title: notification.title,
    body: notification.message,
    data: normalizeNotificationDataForPush({
      ...notification.data,
      eventId: notification.eventId || outboxDoc.eventId,
      notificationId: String(notification._id),
      recipientId: String(notification.recipient),
      recipientModel: notification.recipientModel,
      notificationType: outboxDoc.notificationType,
      category,
      deepLink: notification.deepLink || "",
      imageUrl: notification.imageUrl || "",
      broadcastBatchId: notification.broadcastBatchId || "",
    }),
  };

  let response = null;
  if (activeTokens.length === 1) {
    response = await sendFcmToToken(activeTokens[0].token, pushPayload);
  } else {
    response = await sendFcmMulticast(activeTokens.map((entry) => entry.token), pushPayload);
  }

  if (!response) {
    throw new Error("Firebase messaging unavailable");
  }

  const invalidTokens = [];
  if (response.responses && Array.isArray(response.responses)) {
    response.responses.forEach((item, index) => {
      if (!item?.success) {
        const code = String(item?.error?.code || "");
        if (INVALID_TOKEN_CODES.has(code)) {
          invalidTokens.push(activeTokens[index]?.token);
        }
      }
    });
  }

  if (invalidTokens.length) {
    for (const invalidToken of invalidTokens) {
      // eslint-disable-next-line no-await-in-loop
      await removeRecipientPushToken({
        recipientId: outboxDoc.recipient,
        recipientModel: outboxDoc.recipientModel,
        token: invalidToken,
      });
    }
  }

  await NotificationOutbox.findByIdAndUpdate(outboxDoc._id, {
    $set: {
      status: "sent",
      sentAt: new Date(),
      lastError: invalidTokens.length ? `Removed ${invalidTokens.length} invalid token(s)` : "",
      attempts: Number(outboxDoc.attempts || 0) + 1,
    },
  });

  await Notification.findByIdAndUpdate(notification._id, {
    $set: {
      deliveryStatus: "sent",
      sentAt: new Date(),
      attemptCount: Number(notification.attemptCount || 0) + 1,
      lastError: invalidTokens.length ? `Removed ${invalidTokens.length} invalid token(s)` : "",
    },
  });

  return {
    sent: true,
    invalidTokens,
    response,
  };
}

export function registerNotificationQueueProcessors() {
  if (globalThis.__NOTIFICATION_QUEUE_PROCESSOR_STARTED__) return;
  globalThis.__NOTIFICATION_QUEUE_PROCESSOR_STARTED__ = true;

  notificationQueue.process(
    "deliver-notification",
    parseInt(process.env.NOTIFICATION_QUEUE_CONCURRENCY || "10", 10),
    async (job) => {
      const payload = job.data || {};
      const outboxId = payload.outboxId;
      if (!outboxId) {
        throw new Error("Missing outboxId");
      }

      const outbox = await NotificationOutbox.findById(outboxId);
      if (!outbox) {
        return { skipped: true, reason: "Outbox missing" };
      }

      if (outbox.status === "sent" || outbox.status === "dead_letter") {
        return { skipped: true, reason: `Outbox already ${outbox.status}` };
      }

      await NotificationOutbox.findByIdAndUpdate(outbox._id, {
        $set: {
          status: "processing",
          lockedAt: new Date(),
          attempts: Number(outbox.attempts || 0) + 1,
        },
      });

      try {
        return await sendNotificationForOutbox(outbox);
      } catch (error) {
        const retryable = isRetryableError(error);
        const message = error?.message || "Notification send failed";
        await NotificationOutbox.findByIdAndUpdate(outbox._id, {
          $set: {
            status: retryable ? "failed" : "dead_letter",
            lastError: message,
            failedAt: new Date(),
          },
        });

        if (!retryable || job.attemptsMade + 1 >= (job.opts?.attempts || 5)) {
          await markDeadLetter(outbox, message, error, payload);
          return { deadLettered: true, reason: message };
        }

        throw error;
      }
    },
  );

  notificationQueue.on("failed", async (job, err) => {
    if (!job?.data?.outboxId) return;
    console.error("[notificationQueue] failed", job.id, err?.message);
  });

  notificationQueue.on("completed", (job) => {
    if (!job?.data?.outboxId) return;
    console.log("[notificationQueue] completed", job.id);
  });
}

