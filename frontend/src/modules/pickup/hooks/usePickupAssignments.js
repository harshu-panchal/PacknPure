import { useCallback, useEffect, useRef, useState } from "react";
import { pickupApi } from "../services/pickupApi";
import { getApiErrorMessage } from "../utils/assignmentUtils";

const DEFAULT_POLL_MS = 15000;

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
      if (inFlightRef.current && silent) return;
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
