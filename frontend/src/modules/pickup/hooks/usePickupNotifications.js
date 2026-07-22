import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_ALERTS = 50;
const STORAGE_KEY = "pickup_alerts_v1";

function loadAlerts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAlerts(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ALERTS)));
  } catch {
    /* ignore */
  }
}

/**
 * Tracks assignment changes between polls and surfaces in-app alerts + toasts.
 */
export function usePickupNotifications(rows) {
  const [alerts, setAlerts] = useState(loadAlerts);
  const prevRef = useRef(new Map());

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
      saveAlerts(next);
      return next;
    });
    return item;
  }, []);

  const markAllRead = useCallback(() => {
    setAlerts((prev) => {
      const next = prev.map((a) => ({ ...a, read: true }));
      saveAlerts(next);
      return next;
    });
  }, []);

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
