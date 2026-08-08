import NotificationOutbox from "../models/notificationOutbox.js";
import { processNotificationOutboxJob } from "../queues/notificationQueueProcessors.js";

/**
 * Fallback when Bull/Redis is unavailable: notification delivery (including
 * seller push notifications for new purchase requests) is normally driven by
 * a Bull queue (notificationQueue) that a worker processes — but that queue
 * is a no-op stub whenever Redis is disabled, and its processor is only ever
 * registered behind ENABLE_INLINE_QUEUE_WORKER=true. With neither set, every
 * NotificationOutbox record sits at status "queued" forever and no push ever
 * goes out. This polls for undelivered outbox records and sends them directly.
 */
const DEFAULT_INTERVAL_MS = 5000;
const NOTIFICATION_DELIVERY_INTERVAL_MS = parseInt(
  process.env.NOTIFICATION_DELIVERY_INTERVAL_MS || `${DEFAULT_INTERVAL_MS}`,
  10,
);
const BATCH_SIZE = parseInt(process.env.NOTIFICATION_DELIVERY_BATCH_SIZE || "50", 10);

const processPendingOutbox = async () => {
  try {
    const pending = await NotificationOutbox.find({
      status: { $in: ["queued", "failed"] },
      $expr: { $lt: ["$attempts", "$maxAttempts"] },
    })
      .select("_id attempts")
      .limit(BATCH_SIZE)
      .lean();

    if (!pending.length) return;

    for (const row of pending) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await processNotificationOutboxJob(row._id, { attemptsMade: Number(row.attempts || 0) });
      } catch (err) {
        console.error("[NotificationDeliveryJob] Failed for", row._id, err.message);
      }
    }

    console.log(`[NotificationDeliveryJob] Processed ${pending.length} outbox record(s)`);
  } catch (error) {
    console.error("[NotificationDeliveryJob] Error:", error.message);
  }
};

export const startNotificationDeliveryJob = () => {
  if (globalThis.__NOTIFICATION_DELIVERY_JOB_STARTED__) return;
  globalThis.__NOTIFICATION_DELIVERY_JOB_STARTED__ = true;

  console.log(
    `[NotificationDeliveryJob] Started with interval ${NOTIFICATION_DELIVERY_INTERVAL_MS}ms`,
  );

  setInterval(processPendingOutbox, NOTIFICATION_DELIVERY_INTERVAL_MS);
  void processPendingOutbox();
};

export default startNotificationDeliveryJob;
