import React, { useState } from "react";
import { Zap, CalendarClock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import SlotSelectionSheet from "./SlotSelectionSheet";
import { formatSlotRange } from "../../hooks/useDeliveryMode";

/**
 * DeliveryModeSelector
 *
 * Cart-page selector for the Delivery Mode feature.
 * - Express card: shows admin-configured title + ETA (e.g. "30-60 mins").
 * - Slot card: opens the SlotSelectionSheet; shows chosen date + window.
 * - Cards render only when the corresponding mode is enabled by admin.
 * - Renders nothing when both modes are disabled or config hasn't loaded.
 */

function formatSelectedDate(dateKey) {
  if (!dateKey) return "";
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function DeliveryModeSelector({
  options,
  selection,
  onSelectExpress,
  onSelectSlot,
}) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  if (!options || (!options.expressEnabled && !options.slotEnabled)) {
    return null;
  }

  const isExpress = selection?.mode === "EXPRESS";
  const isSlot = selection?.mode === "SLOT";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">
        Delivery options
      </h3>
      <div className="space-y-2.5">
        {options.expressEnabled && (
          <button
            type="button"
            onClick={onSelectExpress}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
              isExpress
                ? "border-brand-600 bg-brand-50/60"
                : "border-slate-200 hover:border-slate-300",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                isExpress ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-500",
              )}
            >
              <Zap size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-sm font-semibold",
                  isExpress ? "text-brand-700" : "text-slate-800",
                )}
              >
                {options.expressTitle || "Express Delivery"}
              </span>
              <span className="block text-xs text-slate-500">
                Delivery within {options.expressETA}
              </span>
            </span>
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                isExpress ? "border-brand-600" : "border-slate-300",
              )}
            >
              {isExpress && <span className="h-2 w-2 rounded-full bg-brand-600" />}
            </span>
          </button>
        )}

        {options.slotEnabled && (
          <button
            type="button"
            onClick={() => setIsSheetOpen(true)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
              isSlot
                ? "border-brand-600 bg-brand-50/60"
                : "border-slate-200 hover:border-slate-300",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                isSlot ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-500",
              )}
            >
              <CalendarClock size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-sm font-semibold",
                  isSlot ? "text-brand-700" : "text-slate-800",
                )}
              >
                {options.slotTitle || "Slot Delivery"}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {isSlot
                  ? `${formatSelectedDate(selection.selectedDate)}, ${formatSlotRange(selection.selectedSlot)}`
                  : "Choose delivery slot"}
              </span>
            </span>
            {isSlot ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-brand-600">
                <span className="h-2 w-2 rounded-full bg-brand-600" />
              </span>
            ) : (
              <ChevronRight size={16} className="shrink-0 text-slate-400" />
            )}
          </button>
        )}
      </div>

      <SlotSelectionSheet
        open={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        options={options}
        selection={selection}
        onConfirm={onSelectSlot}
      />
    </section>
  );
}
