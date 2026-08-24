const STORAGE_KEY = "pkp_pending_referral_code";

/** Captures ?ref=CODE from the current URL (e.g. a shared referral link) for later use at registration. */
export function captureReferralCodeFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && ref.trim()) {
      localStorage.setItem(STORAGE_KEY, ref.trim().toUpperCase());
    }
  } catch {
    /* ignore */
  }
}

export function getPendingReferralCode() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function clearPendingReferralCode() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
