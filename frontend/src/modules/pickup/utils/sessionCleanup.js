import { clearAllPickupWorkflowPersist } from "./workflowPersist";

const PICKUP_LOCAL_KEYS = [
  "pickup_alerts_v1",
  "pickup_offline_queue_v1",
  "pickup_focus_mode",
];

// Alerts are namespaced per partner as "pickup_alerts_v1_<partnerId>" — match that prefix
// too so logout wipes the current rider's alerts, not just the legacy unscoped key.
const PICKUP_LOCAL_PREFIXES = ["pickup_alerts_v1_"];

/** Clear pickup-specific session/local data on logout (shared-device safety). */
export function clearPickupSessionData() {
  clearAllPickupWorkflowPersist();

  try {
    PICKUP_LOCAL_KEYS.forEach((k) => localStorage.removeItem(k));
    Object.keys(localStorage)
      .filter((k) => PICKUP_LOCAL_PREFIXES.some((prefix) => k.startsWith(prefix)))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
