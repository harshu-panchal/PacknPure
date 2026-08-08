import PurchaseRequest from "../models/purchaseRequest.js";
import { processPickupBroadcastTimeoutJob } from "../controller/purchaseRequestController.js";

/**
 * Fallback when Bull/Redis is unavailable: the pickup broadcast timeout is
 * normally handled by a delayed Bull job (pickupBroadcastQueue), which never
 * fires when Redis is disabled — leaving broadcasting requests stuck forever
 * even though an online partner exists. This polls for expired broadcasts
 * and runs the same auto-assign-best-partner logic directly.
 */
const DEFAULT_INTERVAL_MS = 5000;
const PICKUP_BROADCAST_MONITOR_INTERVAL_MS = parseInt(
  process.env.PICKUP_BROADCAST_MONITOR_INTERVAL_MS || `${DEFAULT_INTERVAL_MS}`,
  10,
);

const processExpiredPickupBroadcasts = async () => {
  try {
    const now = new Date();
    const expired = await PurchaseRequest.find({
      status: "pickup_broadcasting",
      pickupBroadcastExpiresAt: { $lte: now },
    })
      .select("requestId")
      .lean();

    if (!expired.length) return;

    for (const pr of expired) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await processPickupBroadcastTimeoutJob({ requestId: pr.requestId });
      } catch (err) {
        console.error(
          "[PickupBroadcastTimeoutJob] Failed for",
          pr.requestId,
          err.message,
        );
      }
    }

    console.log(
      `[PickupBroadcastTimeoutJob] Processed ${expired.length} expired broadcast(s) at ${now.toISOString()}`,
    );
  } catch (error) {
    console.error("[PickupBroadcastTimeoutJob] Error:", error.message);
  }
};

export const startPickupBroadcastTimeoutJob = () => {
  if (globalThis.__PICKUP_BROADCAST_TIMEOUT_JOB_STARTED__) return;
  globalThis.__PICKUP_BROADCAST_TIMEOUT_JOB_STARTED__ = true;

  console.log(
    `[PickupBroadcastTimeoutJob] Started with interval ${PICKUP_BROADCAST_MONITOR_INTERVAL_MS}ms`,
  );

  setInterval(processExpiredPickupBroadcasts, PICKUP_BROADCAST_MONITOR_INTERVAL_MS);
  void processExpiredPickupBroadcasts();
};

export default startPickupBroadcastTimeoutJob;
