/**
 * Persist pickup workflow drafts across refresh (localStorage + sessionStorage).
 */

const DRAFT_PREFIX = "pickup_draft_v1_";
const ACTIVE_KEY = "pickup_active_assignment";

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    if (value == null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Read flag from localStorage first, then sessionStorage. */
export function readPersistFlag(key) {
  return safeGet(localStorage, key) === "1" || safeGet(sessionStorage, key) === "1";
}

/** Write flag to both storages. */
export function writePersistFlag(key, on) {
  const val = on ? "1" : null;
  safeSet(localStorage, key, val);
  safeSet(sessionStorage, key, val);
}

export function getActiveAssignmentId() {
  return (
    safeGet(localStorage, ACTIVE_KEY) ||
    safeGet(sessionStorage, ACTIVE_KEY) ||
    null
  );
}

export function setActiveAssignmentId(id) {
  if (!id) {
    safeSet(localStorage, ACTIVE_KEY, null);
    safeSet(sessionStorage, ACTIVE_KEY, null);
    return;
  }
  safeSet(localStorage, ACTIVE_KEY, id);
  safeSet(sessionStorage, ACTIVE_KEY, id);
}

export function readStoredImages(key) {
  const raw = safeGet(localStorage, key) || safeGet(sessionStorage, key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.url === "string" && x.url.trim())
      .slice(0, 4)
      .map((x) => ({
        url: x.url.trim(),
        source: x.source === "camera" ? "camera" : "gallery",
      }));
  } catch {
    return [];
  }
}

export function writeStoredImages(key, images) {
  const payload = (images || [])
    .filter((x) => x?.url)
    .slice(0, 4)
    .map((x) => ({ url: x.url, source: x.source || "gallery" }));
  const raw = payload.length ? JSON.stringify(payload) : null;
  safeSet(localStorage, key, raw);
  safeSet(sessionStorage, key, raw);
}

export function readPersistedDraft(id) {
  if (!id) return null;
  const raw = safeGet(localStorage, DRAFT_PREFIX + id) || safeGet(sessionStorage, DRAFT_PREFIX + id);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writePersistedDraft(id, draft) {
  if (!id || !draft) return;
  const slim = {
    accepted: Boolean(draft.accepted),
    acceptedAt: draft.acceptedAt || null,
    navigating: Boolean(draft.navigating),
    navStartedAt: draft.navStartedAt || null,
    sellerReached: Boolean(draft.sellerReached),
    sellerReachedAt: draft.sellerReachedAt || null,
    hubReached: Boolean(draft.hubReached),
    hubReachedAt: draft.hubReachedAt || null,
    hubNavigating: Boolean(draft.hubNavigating),
    hubNavStartedAt: draft.hubNavStartedAt || null,
    vendorImages: (draft.vendorImages || []).slice(0, 4),
    hubImages: (draft.hubImages || []).slice(0, 4),
    otp: String(draft.otp || ""),
    notes: String(draft.notes || ""),
    pickedQty: draft.pickedQty || {},
    photosUploadedAt: draft.photosUploadedAt || null,
    hubPhotosAt: draft.hubPhotosAt || null,
    requireOtpRegen: Boolean(draft.requireOtpRegen),
  };
  const raw = JSON.stringify(slim);
  safeSet(localStorage, DRAFT_PREFIX + id, raw);
  safeSet(sessionStorage, DRAFT_PREFIX + id, raw);

  // Mirror boolean flags for backwards compatibility
  writePersistFlag(`pickup_accepted_${id}`, slim.accepted);
  writePersistFlag(`pickup_nav_${id}`, slim.navigating);
  writePersistFlag(`pickup_seller_reached_${id}`, slim.sellerReached);
  writePersistFlag(`pickup_hub_reached_${id}`, slim.hubReached);
  writePersistFlag(`pickup_hub_nav_${id}`, slim.hubNavigating);
  if (slim.vendorImages?.length) writeStoredImages(`pickup_vendor_imgs_${id}`, slim.vendorImages);
  if (slim.hubImages?.length) writeStoredImages(`pickup_hub_imgs_${id}`, slim.hubImages);
  if (slim.otp) {
    safeSet(localStorage, `pickup_otp_${id}`, slim.otp);
    safeSet(sessionStorage, `pickup_otp_${id}`, slim.otp);
  }
  if (slim.accepted || slim.navigating || slim.sellerReached) {
    setActiveAssignmentId(id);
  }
}

export function clearPersistedDraft(id) {
  if (!id) return;
  safeSet(localStorage, DRAFT_PREFIX + id, null);
  safeSet(sessionStorage, DRAFT_PREFIX + id, null);
}

/** Clear all pickup workflow persistence (logout). */
export function clearAllPickupWorkflowPersist() {
  const clearStore = (storage) => {
    try {
      const keys = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (
          key &&
          (key.startsWith(DRAFT_PREFIX) ||
            key.startsWith("pickup_nav_") ||
            key.startsWith("pickup_accepted_") ||
            key.startsWith("pickup_hub_reached_") ||
            key.startsWith("pickup_seller_reached_") ||
            key.startsWith("pickup_hub_nav_") ||
            key.startsWith("pickup_vendor_imgs_") ||
            key.startsWith("pickup_hub_imgs_") ||
            key.startsWith("pickup_otp_") ||
            key === ACTIVE_KEY)
        ) {
          keys.push(key);
        }
      }
      keys.forEach((k) => storage.removeItem(k));
    } catch {
      /* ignore */
    }
  };
  clearStore(localStorage);
  clearStore(sessionStorage);
}
