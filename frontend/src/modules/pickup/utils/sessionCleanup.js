const PICKUP_SESSION_PREFIXES = ["pickup_nav_", "pickup_accepted_", "pickup_hub_reached_"];
const PICKUP_LOCAL_KEYS = ["pickup_alerts_v1", "pickup_offline_queue_v1"];

/** Clear pickup-specific session/local data on logout (shared-device safety). */
export function clearPickupSessionData() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && PICKUP_SESSION_PREFIXES.some((p) => key.startsWith(p))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }

  try {
    PICKUP_LOCAL_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
