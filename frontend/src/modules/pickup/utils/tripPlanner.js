import { deriveWorkflowPhase, WORKFLOW_PHASE } from "./workflowPhases";

/**
 * Build multi-seller trip state from assignment rows + per-row UI drafts.
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

  let current = null;
  let mode = "idle";

  if (pendingSellers.length > 0) {
    current = pendingSellers[0];
    mode = "seller";
  } else if (pickedAwaitingHub.length > 0) {
    current = pickedAwaitingHub[0];
    mode = "hub";
  }

  const currentIndex = current
    ? sorted.findIndex((r) => r._id === current._id) + 1
    : 0;

  const nextSeller = pendingSellers.length > 1 ? pendingSellers[1] : null;

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
