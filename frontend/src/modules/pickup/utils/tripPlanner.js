import { deriveWorkflowPhase, WORKFLOW_PHASE } from "./workflowPhases";

/**
 * Build multi-seller trip state from assignment rows + per-row UI drafts.
 * Prefers restored "active" assignment after refresh when still in progress.
 */
export function buildTripPlan(rows = [], getDraft = () => ({})) {
  const sorted = [...rows].sort(
    (a, b) =>
      new Date(a.pickupAssignedAt || a.createdAt) -
      new Date(b.pickupAssignedAt || b.createdAt),
  );

  const pendingSellers = sorted.filter((r) => r.status === "pickup_assigned");
  const pickedAwaitingHub = sorted.filter((r) => r.status === "picked");
  const completed = sorted.filter((r) => r.status === "hub_delivered");

  const totalStops = pendingSellers.length + pickedAwaitingHub.length + completed.length;
  const doneStops = completed.length + pickedAwaitingHub.length;
  const sellerDone = completed.length;

  let preferredId = null;
  try {
    preferredId = sessionStorage.getItem("pickup_active_assignment");
  } catch {
    preferredId = null;
  }

  const preferActive = (list) => {
    if (!preferredId || !list.length) return list[0] || null;
    return list.find((r) => r._id === preferredId) || list[0];
  };

  // Prefer assignment that already has in-progress workflow over untouched ones
  const inProgressSeller =
    pendingSellers.find((r) => {
      const phase = deriveWorkflowPhase(r, getDraft(r._id));
      return phase !== WORKFLOW_PHASE.PENDING_ACCEPT && phase !== WORKFLOW_PHASE.ASSIGNED;
    }) ||
    pendingSellers.find((r) => {
      const d = getDraft(r._id);
      return d?.accepted || d?.navigating;
    });

  let current = null;
  let mode = "idle";

  if (pendingSellers.length > 0) {
    current =
      (preferredId && pendingSellers.find((r) => r._id === preferredId)) ||
      inProgressSeller ||
      preferActive(pendingSellers);
    mode = "seller";
  } else if (pickedAwaitingHub.length > 0) {
    current = preferActive(pickedAwaitingHub);
    mode = "hub";
  }

  const currentIndex = current
    ? sorted.findIndex((r) => r._id === current._id) + 1
    : 0;

  const nextSeller = pendingSellers.filter((r) => r._id !== current?._id)[0] || null;

  const progressPct =
    totalStops > 0
      ? Math.round(((completed.length + (pickedAwaitingHub.length > 0 && !pendingSellers.length ? pickedAwaitingHub.length * 0.5 : 0)) / totalStops) * 100)
      : 0;

  const adjustedProgress =
    totalStops > 0
      ? Math.min(
          100,
          Math.round(
            ((completed.length +
              pickedAwaitingHub.filter((r) => getDraft(r._id)?.hubReached).length * 0.25 +
              pendingSellers.filter((r) => {
                const d = getDraft(r._id);
                const phase = deriveWorkflowPhase(r, d);
                return [
                  WORKFLOW_PHASE.OTP_VERIFIED,
                  WORKFLOW_PHASE.OTP_GENERATED,
                  WORKFLOW_PHASE.PHOTO_CAPTURE,
                ].includes(phase);
              }).length *
                0.1) /
              totalStops) *
              100,
          ),
        )
      : 0;

  const estimatedFinish = sorted
    .map((r) => r.eta || r.dates?.eta)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  return {
    sorted,
    pendingSellers,
    pickedAwaitingHub,
    completed,
    current,
    currentIndex,
    nextSeller,
    mode,
    totalStops,
    doneStops: completed.length,
    sellersTotal: pendingSellers.length + completed.length + pickedAwaitingHub.length,
    sellersCompleted: completed.length,
    progressPct: Math.max(adjustedProgress, completed.length && totalStops ? Math.round((completed.length / totalStops) * 100) : 0),
    estimatedFinish,
    hasActiveTrip: Boolean(current),
  };
}

export function getSellerStopsForMap(trip, hubLoc) {
  const stops = [];
  for (const row of trip.pendingSellers) {
    stops.push({
      id: row._id,
      type: "seller",
      label: row.vendor?.name || "Seller",
      status: "remaining",
      loc: row.vendor?.location,
    });
  }
  for (const row of trip.pickedAwaitingHub) {
    stops.push({
      id: row._id,
      type: "seller",
      label: row.vendor?.name || "Seller",
      status: "completed",
      loc: row.vendor?.location,
    });
  }
  for (const row of trip.completed) {
    stops.push({
      id: row._id,
      type: "seller",
      label: row.vendor?.name || "Seller",
      status: "completed",
      loc: row.vendor?.location,
    });
  }
  if (hubLoc) {
    stops.push({
      id: "hub",
      type: "hub",
      label: "Hub",
      status: trip.mode === "hub" ? "current" : trip.pendingSellers.length ? "remaining" : "current",
      loc: { lat: hubLoc.lat, lng: hubLoc.lng },
    });
  }
  if (trip.current) {
    const idx = stops.findIndex((s) => s.id === trip.current._id);
    if (idx >= 0) stops[idx].status = "current";
  }
  return stops;
}
