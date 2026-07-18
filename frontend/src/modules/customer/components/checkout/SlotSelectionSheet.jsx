import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarClock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_COLOR } from "../../constants/brandTheme";
import {
  buildSelectableDates,
  slotsForDate,
  formatSlotRange,
} from "../../hooks/useDeliveryMode";

/**
 * SlotSelectionSheet
 *
 * Blinkit/BigBasket-style bottom sheet for picking a delivery date + time slot.
 * Dates honor admin-disabled weekdays; today's already-elapsed windows are hidden.
 */
export default function SlotSelectionSheet({
  open,
  onClose,
  options,
  selection,
  onConfirm,
}) {
  const dates = useMemo(
    () => buildSelectableDates(options?.availableDays, 7),
    [options?.availableDays],
  );

  const [activeDateKey, setActiveDateKey] = useState(null);
  const [pendingSlot, setPendingSlot] = useState(null);

  // Re-seed local state from the current selection each time the sheet opens
  useEffect(() => {
    if (!open) return;
    const storedDateValid = dates.some((d) => d.dateKey === selection?.selectedDate);
    setActiveDateKey(
      storedDateValid ? selection.selectedDate : dates[0]?.dateKey || null,
    );
    setPendingSlot(
      selection?.mode === "SLOT" && storedDateValid ? selection.selectedSlot : null,
    );
  }, [open, dates, selection]);

  const activeDate = dates.find((d) => d.dateKey === activeDateKey) || null;
  const availableSlots = useMemo(
    () => slotsForDate(options?.slots, activeDate),
    [options?.slots, activeDate],
  );

  const handleConfirm = () => {
    if (!pendingSlot || !activeDateKey) return;
    onConfirm(pendingSlot, activeDateKey);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/50"
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-[95] mx-auto max-w-lg rounded-t-3xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarClock size={18} className="text-brand-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Select delivery slot
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                aria-label="Close slot selection"
              >
                <X size={16} />
              </button>
            </div>

            {/* Date chips */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3">
              {dates.map((d) => {
                const active = d.dateKey === activeDateKey;
                return (
                  <button
                    key={d.dateKey}
                    type="button"
                    onClick={() => {
                      setActiveDateKey(d.dateKey);
                      setPendingSlot(null);
                    }}
                    className={cn(
                      "shrink-0 rounded-xl border px-3.5 py-2 text-center transition-colors",
                      active
                        ? "border-transparent text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                    )}
                    style={active ? { backgroundColor: BRAND_COLOR } : undefined}
                  >
                    <span className="block text-xs font-bold">{d.label}</span>
                    {(d.isToday || d.label === "Tomorrow") && (
                      <span
                        className={cn(
                          "block text-[10px] font-medium",
                          active ? "text-white/80" : "text-slate-400",
                        )}
                      >
                        {d.shortLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Slot grid */}
            <div className="max-h-[45vh] overflow-y-auto px-5 pb-3">
              {availableSlots.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No slots available for this day. Please pick another date.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 py-1">
                  {availableSlots.map((slot) => {
                    const value = `${slot.startTime}-${slot.endTime}`;
                    const active = pendingSlot === value;
                    return (
                      <button
                        key={slot._id || value}
                        type="button"
                        onClick={() => setPendingSlot(value)}
                        className={cn(
                          "relative rounded-xl border px-3 py-3 text-left transition-colors",
                          active
                            ? "border-brand-600 bg-brand-50"
                            : "border-slate-200 bg-white hover:border-slate-300",
                        )}
                      >
                        <span
                          className={cn(
                            "block text-xs font-bold",
                            active ? "text-brand-700" : "text-slate-800",
                          )}
                        >
                          {formatSlotRange(value)}
                        </span>
                        {active && (
                          <span
                            className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: BRAND_COLOR }}
                          >
                            <Check size={10} strokeWidth={4} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Confirm */}
            <div className="border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!pendingSlot}
                className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: BRAND_COLOR }}
              >
                {pendingSlot
                  ? `Confirm ${formatSlotRange(pendingSlot)}`
                  : "Select a time slot"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
