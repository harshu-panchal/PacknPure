import { useCallback, useEffect, useRef, useState } from "react";
import { pickupApi } from "../services/pickupApi";
import { resolveGpsCoords, toGeoPayload } from "../utils/geo";

const isValidCoord = (lat, lng) =>
  Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

export function useLiveLocation(activeAssignmentId) {
  const [liveLoc, setLiveLoc] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const lastPostRef = useRef(0);
  const liveLocRef = useRef(null);
  const enabled = Boolean(activeAssignmentId);

  useEffect(() => {
    liveLocRef.current = liveLoc;
  }, [liveLoc]);

  const postLocation = useCallback(
    async (coords) => {
      if (!isValidCoord(coords?.lat, coords?.lng)) return;
      const now = Date.now();
      if (now - lastPostRef.current < 4000) return;
      lastPostRef.current = now;
      try {
        await pickupApi.updateLiveLocation({
          lat: Number(coords.lat),
          lng: Number(coords.lng),
          heading: coords.heading ?? null,
          speed: coords.speed ?? null,
          assignmentId: activeAssignmentId || null,
        });
      } catch {
        /* non-blocking — avoid surfacing transient post errors as hard GPS failures */
      }
    },
    [activeAssignmentId],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    if (!navigator.geolocation) {
      setGpsError("Location services are unavailable in this browser.");
      return undefined;
    }

    const onSuccess = (pos) => {
      const next = toGeoPayload(pos);
      if (!next) return;
      setLiveLoc(next);
      setGpsAccuracy(next.accuracyM ?? null);
      setGpsError(null);
      postLocation(next);
    };

    const onError = (err) => {
      const code = err?.code;
      // Keep last known location if we already have one
      if (liveLocRef.current && isValidCoord(liveLocRef.current.lat, liveLocRef.current.lng)) {
        if (code === 3) {
          setGpsError("GPS signal weak — using last known location.");
        }
        return;
      }
      if (code === 1) {
        setGpsError("Location permission denied. Enable location for this site and try again.");
      } else if (code === 2) {
        setGpsError("GPS temporarily unavailable. Move outdoors or wait a moment, then retry.");
      } else if (code === 3) {
        setGpsError("Location request timed out. Check GPS signal and try again.");
      } else {
        setGpsError("Could not get a valid location.");
      }
    };

    // Seed with a one-shot read (retries + cache) so workflows aren't blocked waiting on watch.
    resolveGpsCoords({ retries: 2, timeoutMs: 8000, lastKnown: liveLocRef.current })
      .then((coords) => {
        setLiveLoc(coords);
        setGpsAccuracy(coords.accuracyM ?? null);
        setGpsError(null);
        postLocation(coords);
      })
      .catch((err) => {
        if (!liveLocRef.current) onError(err);
      });

    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, postLocation]);

  /**
   * Resolve valid coords for mark-picked / hub-delivered.
   * Retries browser GPS, then falls back to last known liveLoc.
   * Throws with a user-facing message if no valid coords.
   */
  const getCurrentPosition = useCallback(async () => {
    const coords = await resolveGpsCoords({
      retries: 3,
      timeoutMs: 10000,
      lastKnown: liveLocRef.current,
    });
    setLiveLoc(coords);
    setGpsAccuracy(coords.accuracyM ?? null);
    setGpsError(null);
    return {
      latitude: coords.lat,
      longitude: coords.lng,
      lat: coords.lat,
      lng: coords.lng,
      fromCache: Boolean(coords.fromCache),
    };
  }, []);

  return { liveLoc, gpsError, gpsAccuracy, getCurrentPosition };
}
