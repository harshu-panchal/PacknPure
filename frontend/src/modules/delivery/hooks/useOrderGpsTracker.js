import { useEffect, useRef, useCallback } from "react";
import { deliveryApi } from "../services/deliveryApi";
import { saveDeliveryPartnerLocation } from "../utils/deliveryLastLocation";

const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 10000,
  timeout: 20000,
};

/**
 * Order-scoped GPS tracker for delivery partners.
 * Starts when active (order picked / out for delivery), stops when inactive or delivered.
 * Battery-optimized: uses watchPosition with backend throttling.
 */
export function useOrderGpsTracker({ orderId, active, intervalMs = 15000 }) {
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const lastSentRef = useRef(0);
  const offlineQueueRef = useRef(null);

  const sendLocation = useCallback(
    (coords) => {
      const { latitude: lat, longitude: lng, accuracy, heading, speed } = coords;
      saveDeliveryPartnerLocation(lat, lng);
      const now = Date.now();
      if (now - lastSentRef.current < 3000) return;
      lastSentRef.current = now;

      deliveryApi
        .postLocation({
          lat,
          lng,
          accuracy,
          heading: Number.isFinite(heading) ? heading : undefined,
          speed: Number.isFinite(speed) ? speed : undefined,
          orderId: orderId || null,
        })
        .catch(() => {
          offlineQueueRef.current = { lat, lng, accuracy, heading, speed };
        });
    },
    [orderId],
  );

  const flushOffline = useCallback(() => {
    const pending = offlineQueueRef.current;
    if (!pending || !orderId) return;
    deliveryApi
      .postLocation({ ...pending, orderId })
      .then(() => {
        offlineQueueRef.current = null;
      })
      .catch(() => {});
  }, [orderId]);

  useEffect(() => {
    if (!active || !orderId || typeof navigator === "undefined" || !navigator.geolocation) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return undefined;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => sendLocation(pos.coords),
      () => {},
      DEFAULT_OPTIONS,
    );

    intervalRef.current = setInterval(flushOffline, intervalMs);

    const onOnline = () => flushOffline();
    window.addEventListener("online", onOnline);

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      window.removeEventListener("online", onOnline);
    };
  }, [active, orderId, sendLocation, flushOffline, intervalMs]);
}

export default useOrderGpsTracker;
