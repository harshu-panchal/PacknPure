import { formatPrDate } from "@shared/utils/purchaseRequestFormat";
import { deriveWorkflowPhase, WORKFLOW_PHASE } from "./workflowPhases";

/**
 * Merge backend timeline with inferred milestones from assignment + draft state.
 */
export function enrichTimeline(row, draft = {}) {
  const base = Array.isArray(row.timeline) ? [...row.timeline] : [];
  const keys = new Set(base.map((e) => e.key));

  const push = (key, label, at, meta = {}) => {
    if (!at || keys.has(key)) return;
    keys.add(key);
    base.push({
      key,
      label,
      at: new Date(at).toISOString(),
      ...meta,
    });
  };

  if (draft.acceptedAt) {
    push("accepted", "Assignment accepted", draft.acceptedAt);
  }
  if (draft.navigating && row.status === "pickup_assigned") {
    push("nav_started", "Navigation started", draft.navStartedAt || Date.now());
  }
  push("reached_seller", "Reached seller", row.reachedSellerAt || row.pickupProof?.reachedSellerAt);
  if (draft.vendorImages?.length) {
    push("photos_uploaded", "Parcel photos uploaded", draft.photosUploadedAt || Date.now());
  }
  if (row.pickupOtpGenerated) {
    push("otp_generated", "Pickup OTP generated", row.pickupOtpExpiresAt);
  }
  if (row.pickupOtpVerified) {
    push("otp_verified", "OTP verified", row.pickupProof?.pickedAt);
  }
  push("picked", "Pickup confirmed", row.pickupProof?.pickedAt);
  if (draft.hubNavigating) {
    push("hub_nav", "Hub navigation started", draft.hubNavStartedAt || Date.now());
  }
  if (draft.hubReached) {
    push("hub_reached", "Reached hub", draft.hubReachedAt || Date.now());
  }
  if (draft.hubImages?.length) {
    push("hub_photos", "Hub proof captured", draft.hubPhotosAt || Date.now());
  }
  push("hub_delivered", "Hub delivery confirmed", row.hubDropProof?.droppedAt);

  const phase = deriveWorkflowPhase(row, draft);
  if (phase === WORKFLOW_PHASE.COMPLETED && !keys.has("completed")) {
    push("completed", "Assignment completed", row.hubDropProof?.droppedAt || row.updatedAt);
  }

  return base.sort((a, b) => new Date(a.at) - new Date(b.at));
}

export function formatTimelineLabel(event) {
  return event?.label || "Event";
}

export { formatPrDate };
