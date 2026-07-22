import { useCallback, useEffect, useRef, useState } from "react";
import { pickupApi } from "../services/pickupApi";

export function useLiveLocation(activeAssignmentId) {
  const [liveLoc, setLiveLoc] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const lastPostRef = useRef(0);
  const enabled = Boolean(activeAssignmentId);

  const postLocation = useCallback(
    async (coords) => {
      const now = Date.now();
      if (now - lastPostRef.current < 4000) return;
      lastPostRef.current = now;
      try {
        await pickupApi.updateLiveLocation({
          lat: coords.lat,
          lng: coords.lng,
          heading: coords.heading ?? null,
          speed: coords.speed ?? null,
          assignmentId: activeAssignmentId || null,
        });
      } catch {
        /* non-blocking */
      }
    },
    [activeAssignmentId],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported on this device.");
      return undefined;
    }

    const onSuccess = (pos) => {
      const next = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
      };
      setLiveLoc(next);
      setGpsAccuracy(pos.coords.accuracy ?? null);
      setGpsError(null);
      postLocation(next);
    };

    const onError = (err) => {
      const code = err?.code;
      if (code === 1) {
        setGpsError("Location permission denied. Enable GPS in device settings.");
      } else if (code === 2) {
        setGpsError("GPS unavailable. Check that location services are on.");
      } else if (code === 3) {
        setGpsError("Location request timed out. Try again outdoors.");
      } else {
        setGpsError("Could not get your location.");
      }
    };

    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, postLocation]);

  const getCurrentPosition = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported"));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          reject,
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
      }),
    [],
  );

  return { liveLoc, gpsError, gpsAccuracy, getCurrentPosition };
}
