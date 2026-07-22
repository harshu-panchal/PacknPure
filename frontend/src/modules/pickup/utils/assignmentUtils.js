/**
 * Parse GeoJSON Point or { lat, lng } into { lat, lng }.
 */
export function toLatLng(loc) {
  if (!loc) return null;
  if (typeof loc.lat === "number" && typeof loc.lng === "number") {
    return { lat: loc.lat, lng: loc.lng };
  }
  const coords = loc?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

/**
 * Hub coordinates mirror backend env (HUB_LOCATION_LAT/LNG).
 * Not returned by pickup assignment API — aligned with server config, not UI fiction.
 */
export function getHubLocation() {
  const lat = Number(
    import.meta.env.VITE_HUB_LOCATION_LAT ||
      import.meta.env.VITE_HUB_LAT ||
      import.meta.env.VITE_DEFAULT_HUB_LAT,
  );
  const lng = Number(
    import.meta.env.VITE_HUB_LOCATION_LNG ||
      import.meta.env.VITE_HUB_LNG ||
      import.meta.env.VITE_DEFAULT_HUB_LNG,
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function getHubAddress() {
  return (
    import.meta.env.VITE_HUB_LOCATION_ADDRESS ||
    import.meta.env.VITE_HUB_ADDRESS ||
    ""
  );
}

export function parseVendorImageUrls(pickupProof) {
  if (!pickupProof) return [];
  const urls = [];
  if (pickupProof.vendorImageUrl) {
    urls.push(String(pickupProof.vendorImageUrl).trim());
  }
  const notes = String(pickupProof.notes || "");
  const match = notes.match(/VENDOR_IMAGES:([^\n]+)/);
  if (match?.[1]) {
    match[1]
      .split("|")
      .map((u) => u.trim())
      .filter(Boolean)
      .forEach((u) => {
        if (!urls.includes(u)) urls.push(u);
      });
  }
  return urls.slice(0, 4).map((url) => ({ url, source: "gallery" }));
}

export function parseHubImages(hubDropProof) {
  if (!hubDropProof?.hubImageUrl) return [];
  return [{ url: String(hubDropProof.hubImageUrl).trim(), source: "gallery" }];
}

export function parseAssignmentNotes(pickupProof, rowNotes = "") {
  const raw = String(pickupProof?.notes || rowNotes || "");
  return raw
    .split("\n")
    .filter((line) => !line.startsWith("VENDOR_IMAGES:"))
    .join("\n")
    .trim();
}

const R = 6371000;

export function distanceMeters(a, b) {
  if (!a || !b) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(meters) {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatEta(eta) {
  if (!eta) return null;
  const d = new Date(eta);
  if (Number.isNaN(d.getTime())) return null;
  const diffMin = Math.round((d.getTime() - Date.now()) / 60000);
  if (diffMin <= 0) return "Due now";
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function isOtpExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export function getApiErrorMessage(error, fallback = "Something went wrong") {
  if (!navigator.onLine) return "You appear to be offline. Check your connection.";
  const status = error?.response?.status;
  const msg = error?.response?.data?.message;
  if (status === 401) return msg || "Session expired. Please log in again.";
  if (status === 403) return msg || "You do not have permission for this action.";
  if (status === 404) return msg || "Assignment not found. It may have been reassigned.";
  if (status >= 500) return msg || "Server error. Please try again shortly.";
  return msg || error?.message || fallback;
}

export function statusLabel(status) {
  if (!status) return "Unknown";
  return String(status).replace(/_/g, " ");
}
