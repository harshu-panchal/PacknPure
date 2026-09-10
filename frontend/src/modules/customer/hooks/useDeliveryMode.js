import { useCallback, useEffect, useState } from "react";
import { customerApi } from "../services/customerApi";

/**
 * useDeliveryMode
 *
 * Shared state for the Delivery Mode feature (Express vs Slot delivery).
 * - Fetches admin-controlled availability from GET /delivery-mode/options.
 * - Persists the customer's selection in localStorage so the choice made on
 *   the Cart page survives navigation to the Checkout page.
 * - Reconciles a stored selection against the latest admin config (e.g. if
 *   admin disabled slot delivery after the user picked a slot).
 *
 * Selection shape:
 *   { mode: "EXPRESS" }
 *   { mode: "SLOT", selectedSlot: "09:00-12:00", selectedDate: "2026-07-20" }
 */

const STORAGE_KEY = "packnpure_delivery_mode_v1";

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function readStoredSelection() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.mode === "EXPRESS") return { mode: "EXPRESS" };
    if (parsed?.mode === "SLOT" && parsed.selectedSlot && parsed.selectedDate) {
      return {
        mode: "SLOT",
        selectedSlot: parsed.selectedSlot,
        selectedDate: parsed.selectedDate,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function persistSelection(selection) {
  try {
    if (selection) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage errors (private mode etc.)
  }
}

/** "09:00" -> "9:00 AM" for display */
export function formatSlotTime(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "09:00-12:00" -> "9:00 AM - 12:00 PM" */
export function formatSlotRange(slotValue) {
  const [start, end] = String(slotValue || "").split("-");
  if (!start || !end) return slotValue;
  return `${formatSlotTime(start)} - ${formatSlotTime(end)}`;
}

/** Local date -> "YYYY-MM-DD" (avoids UTC shift of toISOString) */
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Build the next `count` selectable dates honoring admin-disabled weekdays.
 */
export function buildSelectableDates(availableDays, count = 7) {
  const dates = [];
  const today = new Date();
  for (let offset = 0; offset < count * 2 && dates.length < count; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const dayKey = DAY_KEYS[date.getDay()];
    if (availableDays && availableDays[dayKey] === false) continue;
    dates.push({
      dateKey: toDateKey(date),
      dayKey,
      isToday: offset === 0,
      label:
        offset === 0
          ? "Today"
          : offset === 1
            ? "Tomorrow"
            : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
      shortLabel: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    });
  }
  return dates;
}

/**
 * Slots applicable for a given date: global ("all") slots + day-specific ones.
 * For today, slots that have passed their 1-hour order acceptance window are filtered out.
 * E.g. For a 9:00 - 12:00 slot, the admin accepts orders only during the first hour (9:00 - 10:00).
 * Once the time passes 10:00, it automatically gets removed from slot booking for Today.
 */
export function slotsForDate(slots, dateEntry, acceptanceWindowMinutes = 60) {
  if (!dateEntry) return [];
  const list = (slots || []).filter(
    (s) => s.day === "all" || s.day === dateEntry.dayKey,
  );
  if (!dateEntry.isToday) return list;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return list.filter((s) => {
    const [startH, startM] = String(s.startTime || "").split(":").map(Number);
    const [endH, endM] = String(s.endTime || "").split(":").map(Number);
    if (!Number.isFinite(startH) || !Number.isFinite(startM)) return false;

    const startMinutes = startH * 60 + startM;
    const endMinutes =
      Number.isFinite(endH) && Number.isFinite(endM)
        ? endH * 60 + endM
        : startMinutes + 180;

    // Cutoff is 1 hour (acceptanceWindowMinutes) after slot start
    const cutoffMinutes = Math.min(
      startMinutes + acceptanceWindowMinutes,
      endMinutes,
    );
    return nowMinutes < cutoffMinutes;
  });
}

export function useDeliveryMode() {
  const [options, setOptions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selection, setSelectionState] = useState(() => readStoredSelection());

  useEffect(() => {
    let mounted = true;
    const fetchOptions = async () => {
      try {
        const res = await customerApi.getDeliveryModes();
        if (mounted && res.data?.success) {
          setOptions(res.data.result);
        }
      } catch {
        // Feature is optional — on failure the selector simply stays hidden
        // and checkout falls back to the default EXPRESS behavior.
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchOptions();
    return () => {
      mounted = false;
    };
  }, []);

  // Reconcile stored selection with the latest admin configuration
  useEffect(() => {
    if (!options) return;
    setSelectionState((prev) => {
      let next = prev;

      if (next?.mode === "SLOT") {
        const selectableDates = buildSelectableDates(options.availableDays, 7);
        const matchingDate = selectableDates.find(
          (d) => d.dateKey === next.selectedDate,
        );
        const validSlots = matchingDate
          ? slotsForDate(
              options.slots,
              matchingDate,
              options.slotAcceptanceWindowMinutes ?? 60,
            )
          : [];
        const stillValid =
          options.slotEnabled &&
          validSlots.some(
            (s) => `${s.startTime}-${s.endTime}` === next.selectedSlot,
          );
        if (!stillValid) next = null;
      }
      if (next?.mode === "EXPRESS" && !options.expressEnabled) {
        next = null;
      }
      // Default to Express when nothing (valid) is selected
      if (!next && options.expressEnabled) {
        next = { mode: "EXPRESS" };
      }

      if (next !== prev) persistSelection(next);
      return next;
    });
  }, [options]);

  const setSelection = useCallback((next) => {
    setSelectionState(next);
    persistSelection(next);
  }, []);

  const selectExpress = useCallback(() => {
    setSelection({ mode: "EXPRESS" });
  }, [setSelection]);

  const selectSlot = useCallback(
    (selectedSlot, selectedDate) => {
      setSelection({ mode: "SLOT", selectedSlot, selectedDate });
    },
    [setSelection],
  );

  return {
    options,
    isLoading,
    selection,
    selectExpress,
    selectSlot,
  };
}

export default useDeliveryMode;
