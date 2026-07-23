import { clearAllPickupWorkflowPersist } from "./workflowPersist";

const PICKUP_LOCAL_KEYS = [
  "pickup_alerts_v1",
  "pickup_offline_queue_v1",
  "pickup_focus_mode",
];

/** Clear pickup-specific session/local data on logout (shared-device safety). */
export function clearPickupSessionData() {
  clearAllPickupWorkflowPersist();

  try {
    PICKUP_LOCAL_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
