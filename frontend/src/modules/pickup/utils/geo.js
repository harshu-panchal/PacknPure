/**
 * Resolve browser GPS with retries + last-known fallback.
 * Never returns invalid coordinates.
 */

const isValidCoord = (lat, lng) =>
  Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

export function toGeoPayload(pos, extras = {}) {
  if (!pos?.coords) return null;
  const lat = Number(pos.coords.latitude);
  const lng = Number(pos.coords.longitude);
  if (!isValidCoord(lat, lng)) return null;
  return {
    lat,
    lng,
    accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : undefined,
    heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : undefined,
    speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : undefined,
    ...extras,
  };
}

function readOnce(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error("Geolocation unavailable on this device"), { code: 0 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * @param {{ retries?: number, timeoutMs?: number, lastKnown?: { lat: number, lng: number } | null }} opts
 * @returns {Promise<{ lat: number, lng: number, accuracyM?: number, heading?: number, speed?: number, fromCache?: boolean }>}
 */
export async function resolveGpsCoords(opts = {}) {
  const retries = Math.max(1, opts.retries ?? 3);
  const timeoutMs = opts.timeoutMs ?? 8000;
  const lastKnown = opts.lastKnown;
  // Prefer existing live location first — avoids long slide "Processing…" waits
  const preferCache = opts.preferCache !== false;
  let lastError = null;

  const cacheFallback = () => {
    if (lastKnown && isValidCoord(lastKnown.lat, lastKnown.lng)) {
      return {
        lat: Number(lastKnown.lat),
        lng: Number(lastKnown.lng),
        accuracyM: Number.isFinite(lastKnown.accuracyM) ? lastKnown.accuracyM : undefined,
        fromCache: true,
      };
    }
    return null;
  };

  if (preferCache) {
    const cached = cacheFallback();
    if (cached) return cached;
  }

  for (let i = 0; i < retries; i += 1) {
    try {
      const pos = await readOnce({
        enableHighAccuracy: i === 0,
        timeout: i === 0 ? timeoutMs : Math.min(timeoutMs, 5000),
        maximumAge: i === 0 ? 5000 : 60000,
      });
      const payload = toGeoPayload(pos);
      if (payload) return payload;
      lastError = new Error("Received invalid coordinates from GPS");
    } catch (err) {
      lastError = err;
      // Permission denied — don't keep retrying
      if (err?.code === 1) break;
      const cached = cacheFallback();
      if (cached) return cached;
      await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
  }

  const cached = cacheFallback();
  if (cached) return cached;

  const code = lastError?.code;
  if (code === 1) {
    throw Object.assign(
      new Error("Location permission denied. Enable location for this site and try again."),
      { code: 1 },
    );
  }
  if (code === 2) {
    throw Object.assign(
      new Error("GPS temporarily unavailable. Move outdoors or wait a moment, then retry."),
      { code: 2 },
    );
  }
  if (code === 3) {
    throw Object.assign(
      new Error("Location request timed out. Check GPS signal and try again."),
      { code: 3 },
    );
  }
  if (code === 0) {
    throw Object.assign(new Error("Location services are unavailable in this browser."), { code: 0 });
  }
  throw Object.assign(
    new Error(lastError?.message || "Could not get a valid location. Please try again."),
    { code: code ?? -1 },
  );
}
