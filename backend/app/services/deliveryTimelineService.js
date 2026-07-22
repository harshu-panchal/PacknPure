import { getDeliveryAuditEvents } from "./deliveryAuditService.js";

const TIMELINE_STEPS = [
  { id: "packed", label: "Packed", auditEvent: null },
  { id: "delivery_assigned", label: "Delivery Assigned", auditEvent: "assigned" },
  { id: "reached_hub", label: "Partner Reached Hub", auditEvent: "reached_hub" },
  { id: "picked", label: "Order Picked", auditEvent: "picked" },
  { id: "out_for_delivery", label: "Out For Delivery", auditEvent: "out_for_delivery" },
  { id: "nearby", label: "Nearby", auditEvent: "nearby" },
  { id: "otp_verification", label: "OTP Verification", auditEvent: "otp_verified" },
  { id: "delivered", label: "Delivered", auditEvent: "delivered" },
];

function tsFromAudit(audits, event) {
  const hit = audits.find((a) => a.event === event);
  return hit?.createdAt ? new Date(hit.createdAt).toISOString() : null;
}

function inferStepStatus(stepIndex, currentIndex) {
  if (currentIndex < 0) return stepIndex === 0 ? "active" : "pending";
  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

/**
 * Build delivery timeline from order timestamps + audit trail.
 * Does not mutate order state.
 */
export function buildDeliveryTimeline(order, audits = []) {
  const wf = String(order.workflowStatus || "").toUpperCase();
  const legacy = String(order.status || "").toLowerCase();

  const timestamps = {
    packed:
      order.readyForDeliveryAt ||
      order.sellerAcceptedAt ||
      (wf === "DELIVERY_SEARCH" || wf === "READY_FOR_DELIVERY" ? order.updatedAt : null),
    delivery_assigned: order.assignedAt || tsFromAudit(audits, "assigned"),
    reached_hub: order.pickupReadyAt || tsFromAudit(audits, "reached_hub"),
    picked: order.pickupConfirmedAt || tsFromAudit(audits, "picked"),
    out_for_delivery: order.outForDeliveryAt || tsFromAudit(audits, "out_for_delivery"),
    nearby: tsFromAudit(audits, "nearby") || tsFromAudit(audits, "reached_customer"),
    otp_verification: order.otpValidatedAt || tsFromAudit(audits, "otp_verified"),
    delivered: order.deliveredAt || order.otpValidatedAt || tsFromAudit(audits, "delivered"),
  };

  let currentIndex = -1;
  if (legacy === "delivered" || wf === "DELIVERED") {
    currentIndex = TIMELINE_STEPS.length - 1;
  } else if (timestamps.otp_verification && !timestamps.delivered) {
    currentIndex = TIMELINE_STEPS.findIndex((s) => s.id === "otp_verification");
  } else if (timestamps.nearby) {
    currentIndex = TIMELINE_STEPS.findIndex((s) => s.id === "nearby");
  } else if (timestamps.out_for_delivery || legacy === "out_for_delivery" || wf === "OUT_FOR_DELIVERY") {
    currentIndex = TIMELINE_STEPS.findIndex((s) => s.id === "out_for_delivery");
  } else if (timestamps.picked) {
    currentIndex = TIMELINE_STEPS.findIndex((s) => s.id === "picked");
  } else if (timestamps.reached_hub || wf === "PICKUP_READY") {
    currentIndex = TIMELINE_STEPS.findIndex((s) => s.id === "reached_hub");
  } else if (timestamps.delivery_assigned || wf === "DELIVERY_ASSIGNED") {
    currentIndex = TIMELINE_STEPS.findIndex((s) => s.id === "delivery_assigned");
  } else if (wf === "DELIVERY_SEARCH" || legacy === "packed" || legacy === "confirmed") {
    currentIndex = TIMELINE_STEPS.findIndex((s) => s.id === "packed");
  }

  const steps = TIMELINE_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: inferStepStatus(index, currentIndex),
    timestamp: timestamps[step.id]
      ? new Date(timestamps[step.id]).toISOString()
      : null,
  }));

  const deliveryDurationMs =
    timestamps.delivery_assigned && timestamps.delivered
      ? new Date(timestamps.delivered).getTime() -
        new Date(timestamps.delivery_assigned).getTime()
      : null;

  return {
    steps,
    currentStepId: currentIndex >= 0 ? TIMELINE_STEPS[currentIndex].id : null,
    deliveryDurationMs,
    auditCount: audits.length,
  };
}

export async function getDeliveryTimelineForOrder(order) {
  const audits = await getDeliveryAuditEvents(order.orderId);
  return buildDeliveryTimeline(order, audits);
}
