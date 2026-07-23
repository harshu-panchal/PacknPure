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
   * Fast coords for mark-picked / hub-delivered.
   * Uses live watch location immediately (no multi-second GPS wait).
   */
  const getCurrentPosition = useCallback(async () => {
    const known = liveLocRef.current;
    if (isValidCoord(known?.lat, known?.lng)) {
      return {
        latitude: Number(known.lat),
        longitude: Number(known.lng),
        lat: Number(known.lat),
        lng: Number(known.lng),
        fromCache: true,
      };
    }
    try {
      const coords = await resolveGpsCoords({
        retries: 1,
        timeoutMs: 2000,
        lastKnown: known,
        preferCache: true,
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
    } catch (err) {
      // Testing / denied GPS: do not block slide for long — use last post or soft fail fast
      setGpsError(err?.message || "Could not get a valid location.");
      throw err;
    }
  }, []);

  return { liveLoc, gpsError, gpsAccuracy, getCurrentPosition };
}
