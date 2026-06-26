import React from "react";
import { cn } from "@/lib/utils";
import { formatPrDate } from "@shared/utils/purchaseRequestFormat";

const PurchaseRequestTimeline = ({ timeline = [], compact = false, className }) => {
  const events = Array.isArray(timeline) ? timeline : [];
  if (!events.length) {
    return (
      <p className="text-sm text-slate-500 italic">No history recorded yet.</p>
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
                className="absolute left-[7px] top-4 h-full w-px bg-slate-200"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white",
                isLast ? "bg-indigo-600" : "bg-slate-300",
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
                <p className="text-[11px] text-slate-600 mt-0.5">Partner: {event.partner}</p>
              ) : null}
              {event.notes ? (
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{event.notes}</p>
              ) : null}
              {event.reason ? (
                <p className="text-[11px] text-rose-600 mt-0.5">{event.reason}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default PurchaseRequestTimeline;
