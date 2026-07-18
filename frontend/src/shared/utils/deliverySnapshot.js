/**
 * Delivery Snapshot display helpers
 *
 * All customer / admin / delivery UIs must read delivery promises from
 * order.deliverySnapshot (immutable). Never invent hardcoded ETAs.
 */

const DAY_LABELS = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

export function getOrderDeliverySnapshot(order) {
  if (!order) return null;
  if (order.deliverySnapshot?.deliveryMode) return order.deliverySnapshot;

  // Legacy fallback from flat fields only (never live admin settings)
  const mode =
    order.deliveryMode === "SLOT" || (order.selectedSlot && order.selectedDate)
      ? "SLOT"
      : "EXPRESS";

  if (mode === "SLOT") {
    const [start, end] = String(order.selectedSlot || "").split("-");
    return {
      deliveryMode: "SLOT",
      deliveryTitle: "Slot Delivery",
      estimatedText: null,
      slotDate: order.selectedDate || null,
      slotStartTime: start || null,
      slotEndTime: end || null,
      slotDisplayText: order.selectedSlot
        ? formatSlotRange12h(order.selectedSlot)
        : null,
      deliveryCharges: Number(order.pricing?.deliveryFee) || 0,
    };
  }

  return {
    deliveryMode: "EXPRESS",
    deliveryTitle: "Express Delivery",
    estimatedText: null,
    estimatedMin: null,
    estimatedMax: null,
    deliveryCharges: Number(order.pricing?.deliveryFee) || 0,
  };
}

export function isSlotDelivery(orderOrSnapshot) {
  const snap =
    orderOrSnapshot?.deliverySnapshot ||
    (orderOrSnapshot?.deliveryMode ? orderOrSnapshot : null);
  const mode = snap?.deliveryMode || orderOrSnapshot?.deliveryMode;
  return mode === "SLOT";
}

export function formatSlotTime12h(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h)) return hhmm || "";
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

export function formatSlotRange12h(slotValue) {
  if (!slotValue) return "";
  if (String(slotValue).includes("AM") || String(slotValue).includes("PM")) {
    return slotValue;
  }
  const [start, end] = String(slotValue).split("-");
  if (!start || !end) return slotValue;
  return `${formatSlotTime12h(start)} - ${formatSlotTime12h(end)}`;
}

export function formatSlotDateLabel(dateKey, { relative = true } = {}) {
  if (!dateKey) return "";
  const [y, m, d] = String(dateKey).split("-").map(Number);
  if (!Number.isFinite(y)) return dateKey;
  const date = new Date(y, m - 1, d);
  if (relative) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const same = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    if (same(date, today)) return "Today";
    if (same(date, tomorrow)) return "Tomorrow";
  }
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatSlotDateFull(dateKey) {
  if (!dateKey) return "";
  const [y, m, d] = String(dateKey).split("-").map(Number);
  if (!Number.isFinite(y)) return dateKey;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function dayLabel(dayKey) {
  return DAY_LABELS[dayKey] || dayKey || "";
}

/** Headline for checkout / order cards */
export function getDeliveryHeadline(snapshot) {
  if (!snapshot) return "Delivery";
  if (snapshot.deliveryMode === "SLOT") {
    return snapshot.deliveryTitle || "Scheduled Delivery";
  }
  return snapshot.deliveryTitle || "Express Delivery";
}

/** Subline: ETA window or scheduled slot */
export function getDeliverySubline(snapshot) {
  if (!snapshot) return "";
  if (snapshot.deliveryMode === "SLOT") {
    const datePart = formatSlotDateLabel(snapshot.slotDate);
    const timePart =
      snapshot.slotDisplayText ||
      formatSlotRange12h(
        snapshot.slotStartTime && snapshot.slotEndTime
          ? `${snapshot.slotStartTime}-${snapshot.slotEndTime}`
          : null,
      );
    if (datePart && timePart) return `${datePart} · ${timePart}`;
    return timePart || datePart || "Scheduled slot";
  }
  if (snapshot.estimatedText) return snapshot.estimatedText;
  if (snapshot.estimatedMin != null && snapshot.estimatedMax != null) {
    return `${snapshot.estimatedMin}-${snapshot.estimatedMax} mins`;
  }
  return "Express delivery";
}

/** Badge label for order history */
export function getDeliveryModeBadge(snapshot) {
  if (!snapshot) return { label: "Express", mode: "EXPRESS" };
  if (snapshot.deliveryMode === "SLOT") {
    return { label: "Slot", mode: "SLOT" };
  }
  return { label: "Express", mode: "EXPRESS" };
}
