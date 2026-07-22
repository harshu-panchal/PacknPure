import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  loadOfflineQueue,
  dequeueOfflineAction,
} from "../utils/offlineQueue";

/**
 * Monitors online status and replays queued actions when connection returns.
 * @param {Function} replayFn - async (action) => void
 */
export function useOfflineQueue(replayFn) {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [queueLen, setQueueLen] = useState(() => loadOfflineQueue().length);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const replayRef = useRef(replayFn);

  useEffect(() => {
    replayRef.current = replayFn;
  }, [replayFn]);

  const refreshLen = useCallback(() => {
    setQueueLen(loadOfflineQueue().length);
  }, []);

  const flush = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return;
    const items = loadOfflineQueue();
    if (!items.length) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      for (const item of items) {
        try {
          await replayRef.current?.(item);
          dequeueOfflineAction(item.id);
        } catch {
          break;
        }
      }
      const remaining = loadOfflineQueue().length;
      if (remaining < items.length) {
        toast.success("Offline actions synced");
      }
      setQueueLen(remaining);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      flush();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flush]);

  return { online, queueLen, syncing, refreshLen, flush };
}
