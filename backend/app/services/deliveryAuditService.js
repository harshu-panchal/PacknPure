import DeliveryAudit from "../models/deliveryAudit.js";

/**
 * Record a delivery audit event without altering order workflow.
 */
export async function recordDeliveryAudit({
  orderId,
  orderRef,
  deliveryBoy,
  event,
  metadata = {},
  gpsSnapshot = null,
  durationMs = null,
}) {
  if (!orderId || !event) return null;
  try {
    return await DeliveryAudit.create({
      orderId: String(orderId),
      orderRef: orderRef || undefined,
      deliveryBoy: deliveryBoy || undefined,
      event,
      metadata,
      gpsSnapshot: gpsSnapshot || undefined,
      durationMs: durationMs ?? undefined,
    });
  } catch (err) {
    console.warn("[DeliveryAudit] Failed to record event:", event, err?.message);
    return null;
  }
}

export async function getDeliveryAuditEvents(orderId, limit = 50) {
  return DeliveryAudit.find({ orderId: String(orderId) })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
}

/** Throttled GPS snapshot — at most one per 60s per order. */
const lastGpsAudit = new Map();

export async function maybeRecordGpsSnapshot(orderId, deliveryBoy, snapshot) {
  const key = String(orderId);
  const now = Date.now();
  const prev = lastGpsAudit.get(key) || 0;
  if (now - prev < 60_000) return null;
  lastGpsAudit.set(key, now);
  return recordDeliveryAudit({
    orderId,
    deliveryBoy,
    event: "gps_snapshot",
    gpsSnapshot: snapshot,
  });
}
