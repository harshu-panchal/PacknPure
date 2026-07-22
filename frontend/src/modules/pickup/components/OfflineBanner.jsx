import React from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { PickupButton } from "./ui";

const OfflineBanner = ({ online, queueLen, syncing, onSync }) => {
  if (online && queueLen === 0) return null;

  return (
    <div
      className={`pickup-safe-x mx-auto max-w-2xl px-3 pt-2 ${online ? "" : "sticky top-0 z-40"}`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold ${
          online ? "bg-amber-50 text-amber-800" : "bg-slate-900 text-white"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <WifiOff size={14} aria-hidden />
          {!online
            ? "You're offline — viewing cached data; sync when connected"
            : `${queueLen} queued action(s) — tap Sync to retry`}
        </div>
        {online && queueLen > 0 && (
          <PickupButton
            size="sm"
            variant="secondary"
            icon={RefreshCw}
            loading={syncing}
            onClick={onSync}
            aria-label="Sync offline actions"
          >
            Sync
          </PickupButton>
        )}
      </div>
    </div>
  );
};

export default OfflineBanner;
