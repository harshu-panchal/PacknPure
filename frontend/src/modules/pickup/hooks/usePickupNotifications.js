import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_ALERTS = 50;
const STORAGE_PREFIX = "pickup_alerts_v1";
// Pre-scoping storage key (before alerts were namespaced per partner). Removed on mount so
// it can never leak a previous rider's alerts into a new rider's session on a shared device.
const LEGACY_STORAGE_KEY = "pickup_alerts_v1";

function loadAlerts(key) {
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveAlerts(key, items) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_ALERTS)));
  } catch {
    /* ignore */
  }
}

/**
 * Tracks assignment changes between polls and surfaces in-app alerts + toasts.
 * Alerts are persisted per logged-in partner (partnerId) so a new rider logging in
 * on a device a previous rider didn't explicitly log out of never inherits their alerts.
 */
export function usePickupNotifications(rows, partnerId) {
  const storageKey = partnerId ? `${STORAGE_PREFIX}_${partnerId}` : null;
  const [alerts, setAlerts] = useState(() => loadAlerts(storageKey));
  const prevRef = useRef(new Map());
  const loadedPartnerRef = useRef(partnerId);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Re-scope alerts if the logged-in partner changes without a full page reload
  // (e.g. rider A never hit logout, rider B logs in on the same device).
  useEffect(() => {
    if (partnerId === loadedPartnerRef.current) return;
    loadedPartnerRef.current = partnerId;
    prevRef.current = new Map();
    setAlerts(loadAlerts(storageKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  const pushAlert = useCallback((type, title, message) => {
    const item = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type,
      title,
      message,
      at: new Date().toISOString(),
      read: false,
    };
    setAlerts((prev) => {
      const next = [item, ...prev].slice(0, MAX_ALERTS);
      saveAlerts(storageKey, next);
      return next;
    });
    return item;
  }, [storageKey]);

  const markAllRead = useCallback(() => {
    setAlerts((prev) => {
      const next = prev.map((a) => ({ ...a, read: true }));
      saveAlerts(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  useEffect(() => {
    if (!rows?.length) return;
    const prev = prevRef.current;

    for (const row of rows) {
      const id = row._id;
      const old = prev.get(id);
      if (!old) {
        if (prev.size > 0 && document.visibilityState === "visible") {
          pushAlert("assignment", "New assignment", `${row.vendor?.name || "Seller"} · ${row.requestId}`);
          toast.info(`New pickup: ${row.vendor?.name || "Seller"}`);
        }
        prev.set(id, { status: row.status, otpGen: row.pickupOtpGenerated, otpVer: row.pickupOtpVerified });
        continue;
      }

      if (old.status !== row.status) {
        if (row.status === "picked") {
          pushAlert("success", "Pickup completed", `${row.vendor?.name} picked up`);
          toast.success(`Picked up from ${row.vendor?.name || "seller"}`);
        } else if (row.status === "hub_delivered") {
          pushAlert("success", "Hub delivered", `${row.requestId} delivered to hub`);
          toast.success("Delivered to hub");
        }
      }
      if (!old.otpGen && row.pickupOtpGenerated) {
        pushAlert("otp", "OTP generated", `OTP ready for ${row.vendor?.name}`);
      }
      if (!old.otpVer && row.pickupOtpVerified) {
        pushAlert("otp", "OTP verified", `Verified at ${row.vendor?.name}`);
      }

      prev.set(id, { status: row.status, otpGen: row.pickupOtpGenerated, otpVer: row.pickupOtpVerified });
    }
  }, [rows, pushAlert]);

  return { alerts, unreadCount, pushAlert, markAllRead, setAlerts };
}
