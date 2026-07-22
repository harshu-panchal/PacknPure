import React from "react";
import { cn } from "../../utils/cn";
import { formatPrDate } from "@shared/utils/purchaseRequestFormat";

/**
 * Pickup-specific timeline — do not modify shared PurchaseRequestTimeline.
 */
const PickupTimeline = ({ timeline = [], compact = false, className }) => {
  const events = Array.isArray(timeline) ? timeline : [];

  if (!events.length) {
    return (
      <p className="text-xs font-medium italic text-slate-400">No trip history yet.</p>
    );
  }

  return (
    <ol className={cn("relative space-y-0", className)}>
      {events.map((event, idx) => {
        const isLast = idx === events.length - 1;
        return (
          <li key={`${event.key}-${idx}`} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast && (
              <span
                className="absolute left-[7px] top-4 h-full w-px bg-gradient-to-b from-teal-200 to-slate-200"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white",
                isLast ? "bg-teal-600 shadow-[0_0_0_3px_rgba(13,148,136,0.2)]" : "bg-slate-300",
              )}
            />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "font-semibold text-slate-900",
                  compact ? "text-xs" : "text-sm",
                )}
              >
                {event.label}
              </p>
              <p className={cn("text-slate-500", compact ? "text-[11px]" : "text-xs")}>
                {formatPrDate(event.at)}
              </p>
              {event.partner ? (
                <p className="mt-0.5 text-[11px] text-slate-600">Partner: {event.partner}</p>
              ) : null}
              {event.notes ? (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{event.notes}</p>
              ) : null}
              {event.reason ? (
                <p className="mt-0.5 text-[11px] text-rose-600">{event.reason}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default PickupTimeline;
