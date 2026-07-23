/**
 * Workflow phases derived from backend assignment state + UI flags.
 */
export const WORKFLOW_PHASE = {
  PENDING_ACCEPT: "PENDING_ACCEPT",
  ASSIGNED: "ASSIGNED",
  NAVIGATING: "NAVIGATING",
  PHOTO_CAPTURE: "PHOTO_CAPTURE",
  OTP_GENERATED: "OTP_GENERATED",
  OTP_VERIFIED: "OTP_VERIFIED",
  PICKED: "PICKED",
  HUB_NAVIGATING: "HUB_NAVIGATING",
  HUB_AT_HUB: "HUB_AT_HUB",
  COMPLETED: "COMPLETED",
};

export const WORKFLOW_STEPS = [
  { id: "accept", label: "Accept" },
  { id: "nav", label: "Navigate" },
  { id: "arrive", label: "Arrive" },
  { id: "photos", label: "Photos" },
  { id: "otp-gen", label: "OTP" },
  { id: "otp-verify", label: "Verify" },
  { id: "confirm", label: "Confirm" },
  { id: "hub", label: "Hub" },
];

const PHASE_TO_STEP_INDEX = {
  [WORKFLOW_PHASE.PENDING_ACCEPT]: 0,
  [WORKFLOW_PHASE.ASSIGNED]: 1,
  [WORKFLOW_PHASE.NAVIGATING]: 2,
  [WORKFLOW_PHASE.PHOTO_CAPTURE]: 3,
  [WORKFLOW_PHASE.OTP_GENERATED]: 4,
  [WORKFLOW_PHASE.OTP_VERIFIED]: 5,
  [WORKFLOW_PHASE.PICKED]: 7,
  [WORKFLOW_PHASE.HUB_NAVIGATING]: 7,
  [WORKFLOW_PHASE.HUB_AT_HUB]: 7,
  [WORKFLOW_PHASE.COMPLETED]: 7,
};

/**
 * @param {object} assignment - API assignment row
 * @param {object} ui - draft flags
 */
function hasParcelPhotos(assignment, ui = {}) {
  if (Array.isArray(ui.vendorImages) && ui.vendorImages.length > 0) return true;
  if (assignment?.pickupProof?.vendorImageUrl) return true;
  const notes = String(assignment?.pickupProof?.notes || "");
  return notes.includes("VENDOR_IMAGES:");
}

/** Backend already advanced past accept — restore mid-flow after refresh. */
export function hasBackendProgress(assignment, ui = {}) {
  if (!assignment) return false;
  if (assignment.status === "picked" || assignment.status === "hub_delivered") return true;
  if (assignment.reachedSellerAt || assignment.pickupProof?.reachedSellerAt) return true;
  if (assignment.pickupOtpGenerated || assignment.pickupOtpVerified) return true;
  return hasParcelPhotos(assignment, ui);
}

export function deriveWorkflowPhase(assignment, ui = {}) {
  const status = assignment?.status;
  const navigating = Boolean(ui.navigating);
  const hubReached = Boolean(ui.hubReached);
  const progressed = hasBackendProgress(assignment, ui);
  // Treat as accepted if UI flag set OR backend already progressed (refresh restore).
  const accepted = Boolean(ui.accepted) || progressed;

  if (status === "hub_delivered") return WORKFLOW_PHASE.COMPLETED;

  if (status === "picked") {
    if (hubReached) return WORKFLOW_PHASE.HUB_AT_HUB;
    if (navigating) return WORKFLOW_PHASE.HUB_NAVIGATING;
    return WORKFLOW_PHASE.PICKED;
  }

  if (status !== "pickup_assigned") return WORKFLOW_PHASE.COMPLETED;

  if (!accepted) return WORKFLOW_PHASE.PENDING_ACCEPT;

  const reached = Boolean(
    assignment.reachedSellerAt || assignment.pickupProof?.reachedSellerAt,
  );
  const photosReady = hasParcelPhotos(assignment, ui);

  // Photos are required before OTP UI — assign-time OTP must not skip this step.
  if (reached && !photosReady) return WORKFLOW_PHASE.PHOTO_CAPTURE;

  if (assignment.pickupOtpVerified && photosReady) return WORKFLOW_PHASE.OTP_VERIFIED;
  if (assignment.pickupOtpGenerated && photosReady) return WORKFLOW_PHASE.OTP_GENERATED;

  if (reached) return WORKFLOW_PHASE.PHOTO_CAPTURE;
  if (navigating) return WORKFLOW_PHASE.NAVIGATING;

  return WORKFLOW_PHASE.ASSIGNED;
}

export function getWorkflowStepIndex(phase) {
  return PHASE_TO_STEP_INDEX[phase] ?? 0;
}

export function shouldShowMap(phase) {
  return [
    WORKFLOW_PHASE.NAVIGATING,
    WORKFLOW_PHASE.PHOTO_CAPTURE,
    WORKFLOW_PHASE.OTP_GENERATED,
    WORKFLOW_PHASE.OTP_VERIFIED,
    WORKFLOW_PHASE.PICKED,
    WORKFLOW_PHASE.HUB_NAVIGATING,
    WORKFLOW_PHASE.HUB_AT_HUB,
  ].includes(phase);
}

export function getNextActionLabel(phase) {
  const labels = {
    [WORKFLOW_PHASE.PENDING_ACCEPT]: "Accept assignment",
    [WORKFLOW_PHASE.ASSIGNED]: "Start navigation",
    [WORKFLOW_PHASE.NAVIGATING]: "Confirm arrival",
    [WORKFLOW_PHASE.PHOTO_CAPTURE]: "Capture photos",
    [WORKFLOW_PHASE.OTP_GENERATED]: "Verify OTP",
    [WORKFLOW_PHASE.OTP_VERIFIED]: "Confirm pickup",
    [WORKFLOW_PHASE.PICKED]: "Go to hub",
    [WORKFLOW_PHASE.HUB_NAVIGATING]: "Confirm at hub",
    [WORKFLOW_PHASE.HUB_AT_HUB]: "Complete delivery",
    [WORKFLOW_PHASE.COMPLETED]: "Done",
  };
  return labels[phase] || "Continue";
}
