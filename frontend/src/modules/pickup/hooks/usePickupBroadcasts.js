import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { pickupApi } from "../services/pickupApi";
import { getApiErrorMessage } from "../utils/assignmentUtils";
import {
  onPickupBroadcast,
  onPickupBroadcastWithdrawn,
} from "@core/services/orderSocket";

const POLL_MS = 15000;
const getToken = () => localStorage.getItem("auth_pickup_partner");

export function usePickupBroadcasts({ onAccepted } = {}) {
  const [broadcasts, setBroadcasts] = useState([]);
  const [acceptingId, setAcceptingId] = useState("");
  const mountedRef = useRef(true);
  // Rejecting a broadcast is local-only — every online partner is offered
  // the same broadcast simultaneously (first to accept wins), so "reject"
  // just means "stop ringing on my device"; it must not affect other
  // partners' copies. Dismissed ids are filtered out of every future poll
  // until the request itself disappears (accepted elsewhere / expired).
  const dismissedIdsRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await pickupApi.getBroadcasts();
      const items = res?.data?.result?.items || [];
      const filtered = (Array.isArray(items) ? items : []).filter(
        (b) => !dismissedIdsRef.current.has(b.requestId),
      );
      if (mountedRef.current) setBroadcasts(filtered);
    } catch {
      /* silent — broadcasts are a best-effort surface, main assignments list is authoritative */
    }
  }, []);

  const dismissBroadcast = useCallback((requestId) => {
    dismissedIdsRef.current.add(requestId);
    setBroadcasts((prev) => prev.filter((b) => b.requestId !== requestId));
  }, []);

  useEffect(() => {
    fetchBroadcasts();
    const timer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      fetchBroadcasts();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchBroadcasts]);

  useEffect(() => {
    const offNew = onPickupBroadcast(getToken, (payload) => {
      if (dismissedIdsRef.current.has(payload.requestId)) return;
      setBroadcasts((prev) => {
        if (prev.some((b) => b.requestId === payload.requestId)) return prev;
        toast.info(`New pickup request: ${payload.vendorName || "a vendor"}`);
        return [
          {
            requestId: payload.requestId,
            purchaseRequestId: payload.purchaseRequestId,
            hubId: payload.hubId,
            vendorName: payload.vendorName || "",
            itemSummary: "Products",
            itemCount: 1,
            expiresAt: payload.expiresAt,
          },
          ...prev,
        ];
      });
    });
    const offWithdrawn = onPickupBroadcastWithdrawn(getToken, (payload) => {
      setBroadcasts((prev) => prev.filter((b) => b.requestId !== payload.requestId));
    });
    return () => {
      offNew();
      offWithdrawn();
    };
  }, []);

  const acceptBroadcast = useCallback(
    async (requestId) => {
      setAcceptingId(requestId);
      try {
        await pickupApi.acceptBroadcast(requestId);
        setBroadcasts((prev) => prev.filter((b) => b.requestId !== requestId));
        toast.success("Pickup request accepted");
        if (typeof onAccepted === "function") onAccepted();
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Could not accept — it may already be taken"));
        fetchBroadcasts();
      } finally {
        setAcceptingId("");
      }
    },
    [onAccepted, fetchBroadcasts],
  );

  return { broadcasts, acceptingId, acceptBroadcast, dismissBroadcast };
}
