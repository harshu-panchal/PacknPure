import DeliverySettings from "../models/deliverySettings.js";
import DeliverySlot from "../models/deliverySlot.js";

/**
 * Delivery Snapshot Service
 *
 * Builds an immutable deliverySnapshot for an Order at creation time.
 * After the order is saved, UI must read ONLY from this snapshot —
 * never from live DeliverySettings — so admin ETA/slot changes do not
 * rewrite the promise already made to the customer.
 */

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** "09:00" -> "9:00 AM" */
export function formatSlotTime12h(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h)) return hhmm || "";
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

export function formatSlotDisplayText(startTime, endTime) {
  if (!startTime || !endTime) return null;
  return `${formatSlotTime12h(startTime)} - ${formatSlotTime12h(endTime)}`;
}

function dayKeyFromDate(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  return DAY_KEYS[date.getDay()] || null;
}

/**
 * Build immutable delivery snapshot from current admin config + customer selection.
 *
 * @param {object} params
 * @param {"EXPRESS"|"SLOT"|string} params.deliveryMode
 * @param {string|null} params.selectedSlot - e.g. "09:00-12:00"
 * @param {string|null} params.selectedDate - e.g. "2026-07-20"
 * @param {string|null} params.slotId - optional DeliverySlot _id
 * @param {number} params.deliveryCharges - fee charged on this order
 * @returns {Promise<object>} deliverySnapshot
 */
export async function buildDeliverySnapshot({
  deliveryMode,
  selectedSlot = null,
  selectedDate = null,
  slotId = null,
  deliveryCharges = 0,
} = {}) {
  const settings = await DeliverySettings.getSingleton();
  const mode = deliveryMode === "SLOT" ? "SLOT" : "EXPRESS";
  const charges = Number(deliveryCharges) || 0;

  if (mode === "SLOT") {
    let startTime = null;
    let endTime = null;
    let resolvedSlotId = slotId || null;

    if (selectedSlot && typeof selectedSlot === "string" && selectedSlot.includes("-")) {
      const [start, end] = selectedSlot.split("-");
      startTime = start || null;
      endTime = end || null;
    }

    // Prefer looking up the slot document for id + exact times
    if (resolvedSlotId || (startTime && endTime)) {
      const query = resolvedSlotId
        ? { _id: resolvedSlotId }
        : { startTime, endTime, enabled: true };
      const slotDoc = await DeliverySlot.findOne(query).lean();
      if (slotDoc) {
        resolvedSlotId = String(slotDoc._id);
        startTime = slotDoc.startTime;
        endTime = slotDoc.endTime;
      }
    }

    const slotDay = dayKeyFromDate(selectedDate);
    const slotDisplayText = formatSlotDisplayText(startTime, endTime);

    return {
      deliveryMode: "SLOT",
      deliveryTitle: settings.slotTitle || "Slot Delivery",
      estimatedMin: null,
      estimatedMax: null,
      estimatedText: slotDisplayText,
      slotId: resolvedSlotId,
      slotDate: selectedDate || null,
      slotDay,
      slotStartTime: startTime,
      slotEndTime: endTime,
      slotDisplayText,
      deliveryCharges: charges,
    };
  }

  // EXPRESS
  const min = Number(settings.expressMinTime) || 30;
  const max = Number(settings.expressMaxTime) || 60;
  const estimatedText = `${min}-${max} mins`;

  return {
    deliveryMode: "EXPRESS",
    deliveryTitle: settings.expressTitle || "Express Delivery",
    estimatedMin: min,
    estimatedMax: max,
    estimatedText,
    slotId: null,
    slotDate: null,
    slotDay: null,
    slotStartTime: null,
    slotEndTime: null,
    slotDisplayText: null,
    deliveryCharges: charges,
  };
}

/**
 * Fallback snapshot for legacy orders that predate deliverySnapshot.
 * Uses fields already stored on the order (deliveryMode / selectedSlot / selectedDate).
 * Does NOT read live DeliverySettings (would rewrite historical promises).
 */
export function legacyDeliverySnapshotFromOrder(order = {}) {
  const mode =
    order.deliveryMode === "SLOT" ||
    (order.selectedSlot && order.selectedDate)
      ? "SLOT"
      : "EXPRESS";

  if (mode === "SLOT") {
    let startTime = null;
    let endTime = null;
    if (order.selectedSlot && String(order.selectedSlot).includes("-")) {
      const [s, e] = String(order.selectedSlot).split("-");
      startTime = s || null;
      endTime = e || null;
    }
    const slotDisplayText = formatSlotDisplayText(startTime, endTime);
    return {
      deliveryMode: "SLOT",
      deliveryTitle: "Slot Delivery",
      estimatedMin: null,
      estimatedMax: null,
      estimatedText: slotDisplayText,
      slotId: null,
      slotDate: order.selectedDate || null,
      slotDay: dayKeyFromDate(order.selectedDate),
      slotStartTime: startTime,
      slotEndTime: endTime,
      slotDisplayText,
      deliveryCharges: Number(order.pricing?.deliveryFee) || 0,
    };
  }

  return {
    deliveryMode: "EXPRESS",
    deliveryTitle: "Express Delivery",
    estimatedMin: null,
    estimatedMax: null,
    estimatedText: null,
    slotId: null,
    slotDate: null,
    slotDay: null,
    slotStartTime: null,
    slotEndTime: null,
    slotDisplayText: null,
    deliveryCharges: Number(order.pricing?.deliveryFee) || 0,
  };
}

export default { buildDeliverySnapshot, legacyDeliverySnapshotFromOrder };
