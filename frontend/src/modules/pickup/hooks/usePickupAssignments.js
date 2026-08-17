import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { pickupApi } from "../services/pickupApi";
import { getApiErrorMessage } from "../utils/assignmentUtils";
import { onPickupAssigned } from "@core/services/orderSocket";
import orderAlertSound from "@/assets/order-alert.mp3";

const DEFAULT_POLL_MS = 15000;
const getToken = () => localStorage.getItem("auth_pickup_partner");

function playAssignmentAlert() {
  try {
    const audio = new Audio(orderAlertSound);
    audio.volume = 1;
    audio.play().catch(() => {});
  } catch {
    /* audio optional */
  }
}

export function usePickupAssignments(statusFilter = "active", pollMs = DEFAULT_POLL_MS) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchAssignments = useCallback(
    async (opts = {}) => {
      const silent = Boolean(opts.silent);
      const force = Boolean(opts.force);
      // Silent polls can skip when busy — forced refreshes after actions must always run
      if (inFlightRef.current && silent && !force) return;
      // If a poll is in flight and we need fresh data, wait briefly then fetch
      if (inFlightRef.current && force) {
        let waits = 0;
        while (inFlightRef.current && waits < 20) {
          await new Promise((r) => setTimeout(r, 50));
          waits += 1;
        }
      }
      inFlightRef.current = true;
      try {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        setError(null);
        const res = await pickupApi.getAssignments({ status: statusFilter });
        const items = res?.data?.result?.items || [];
        if (mountedRef.current) {
          setRows(Array.isArray(items) ? items : []);
        }
        return items;
      } catch (err) {
        if (mountedRef.current) {
          setError(getApiErrorMessage(err, "Failed to load assignments"));
          if (!silent) setRows([]);
        }
        throw err;
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    fetchAssignments().catch(() => {});

    const tick = () => {
      if (document.visibilityState === "hidden") return;
      fetchAssignments({ silent: true }).catch(() => {});
    };

    const timer = setInterval(tick, pollMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchAssignments, pollMs]);

  // Direct assignment (admin manual assign, or the broadcast-timeout
  // auto-assign fallback) never goes through the broadcast accept flow, so
  // the partner would otherwise only learn about it on the next silent poll
  // (up to `pollMs` later) via a quiet toast — easy to miss if the app isn't
  // in focus. Mirror the same loud alert used for live broadcasts and
  // refresh immediately instead of waiting for the next tick.
  useEffect(() => {
    const off = onPickupAssigned(getToken, (payload) => {
      playAssignmentAlert();
      toast.info(`New pickup assigned: ${payload?.productSummary || "task"}`, { duration: 8000 });
      fetchAssignments({ silent: true, force: true }).catch(() => {});
    });
    return off;
  }, [fetchAssignments]);

  const stats = {
    assigned: rows.filter((r) => r.status === "pickup_assigned").length,
    picked: rows.filter((r) => r.status === "picked").length,
    delivered: rows.filter((r) => r.status === "hub_delivered").length,
    total: rows.length,
  };

  return {
    rows,
    loading,
    refreshing,
    error,
    stats,
    fetchAssignments,
    setRows,
  };
}
