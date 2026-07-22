import React from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { PickupButton } from "./ui";

const OfflineBanner = ({ online, queueLen, syncing, onSync }) => {
  if (online && queueLen === 0) return null;

  return (
    <div
      className={`pickup-safe-x mx-auto max-w-2xl px-3 pt-2.5 ${online ? "" : "sticky top-0 z-40"}`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-xs font-semibold shadow-[var(--pickup-shadow-xs)] ${
          online
            ? "border border-amber-100 bg-amber-50/95 text-amber-900"
            : "border border-white/10 bg-slate-950 text-white"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
              online ? "bg-amber-100 text-amber-700" : "bg-white/10 text-teal-300"
            }`}
          >
            <WifiOff size={14} aria-hidden />
          </span>
          <span className="leading-snug">
            {!online
              ? "You're offline — viewing cached data; sync when connected"
              : `${queueLen} queued action(s) — tap Sync to retry`}
          </span>
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
