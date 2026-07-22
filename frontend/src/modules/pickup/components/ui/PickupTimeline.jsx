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
          <li key={`${event.key}-${idx}`} className="relative flex gap-3.5 pb-5 last:pb-0">
            {!isLast && (
              <span
                className="absolute left-[9px] top-5 h-[calc(100%-8px)] w-[2px] rounded-full bg-gradient-to-b from-teal-300 via-teal-100 to-slate-100"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full",
                isLast
                  ? "bg-teal-600 shadow-[0_0_0_4px_rgba(13,148,136,0.18)] ring-2 ring-white"
                  : "bg-white ring-2 ring-slate-200",
              )}
            >
              {isLast ? (
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={cn(
                  "font-bold tracking-tight text-slate-900",
                  compact ? "text-xs" : "text-sm",
                  isLast && "text-teal-800",
                )}
              >
                {event.label}
              </p>
              <p
                className={cn(
                  "mt-0.5 font-medium text-slate-400",
                  compact ? "text-[11px]" : "text-xs",
                )}
              >
                {formatPrDate(event.at)}
              </p>
              {event.partner ? (
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  Partner: {event.partner}
                </p>
              ) : null}
              {event.notes ? (
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                  {event.notes}
                </p>
              ) : null}
              {event.reason ? (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">{event.reason}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default PickupTimeline;
