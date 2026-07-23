import { formatPrDate } from "@shared/utils/purchaseRequestFormat";
import { deriveWorkflowPhase, hasBackendProgress, WORKFLOW_PHASE } from "./workflowPhases";

/**
 * Merge backend timeline with inferred milestones from assignment + draft state.
 * Restored workflow after refresh must still show completed steps.
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

  const progressed = hasBackendProgress(row, draft);
  const accepted = Boolean(draft.accepted) || progressed;
  const reachedAt =
    row.reachedSellerAt ||
    row.pickupProof?.reachedSellerAt ||
    draft.sellerReachedAt ||
    (draft.sellerReached ? Date.now() : null);

  if (accepted) {
    push(
      "accepted",
      "Assignment accepted",
      draft.acceptedAt || row.pickupAssignedAt || reachedAt || Date.now(),
    );
  }
  if ((draft.navigating || reachedAt) && row.status === "pickup_assigned") {
    push(
      "nav_started",
      "Navigation started",
      draft.navStartedAt || reachedAt || Date.now(),
    );
  }
  push("reached_seller", "Reached seller", reachedAt);

  const hasPhotos =
    (draft.vendorImages?.length || 0) > 0 || Boolean(row.pickupProof?.vendorImageUrl);
  if (hasPhotos) {
    push(
      "photos_uploaded",
      "Parcel photos uploaded",
      draft.photosUploadedAt || reachedAt || row.pickupOtpExpiresAt || Date.now(),
    );
  }
  if (row.pickupOtpGenerated) {
    push("otp_generated", "Pickup OTP generated", row.pickupOtpExpiresAt);
  }
  if (row.pickupOtpVerified) {
    push(
      "otp_verified",
      "OTP verified",
      row.pickupProof?.pickedAt || row.pickupOtpExpiresAt || Date.now(),
    );
  }
  push("picked", "Pickup confirmed", row.pickupProof?.pickedAt);

  if (draft.hubNavigating || (row.status === "picked" && draft.navigating)) {
    push("hub_nav", "Hub navigation started", draft.hubNavStartedAt || draft.navStartedAt || Date.now());
  }
  if (draft.hubReached) {
    push("hub_reached", "Reached hub", draft.hubReachedAt || Date.now());
  }
  if ((draft.hubImages?.length || 0) > 0 || row.hubDropProof?.hubImageUrl) {
    push(
      "hub_photos",
      "Hub proof captured",
      draft.hubPhotosAt || row.hubDropProof?.droppedAt || Date.now(),
    );
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
