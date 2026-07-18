import DeliverySettings, { DAY_KEYS } from "../models/deliverySettings.js";
import DeliverySlot, { TIME_REGEX } from "../models/deliverySlot.js";
import handleResponse from "../utils/helper.js";

/**
 * Delivery Mode Controller
 *
 * Standalone feature module for Express / Slot delivery configuration.
 * Does NOT touch order, inventory, procurement or payment logic — it only
 * manages the DeliverySettings singleton and the DeliverySlot collection.
 */

/* ---------- helpers ---------- */

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

const sanitizeSettingsPayload = (raw = {}) => {
  const payload = {};

  if (typeof raw.expressEnabled === "boolean") payload.expressEnabled = raw.expressEnabled;
  if (typeof raw.slotEnabled === "boolean") payload.slotEnabled = raw.slotEnabled;

  if (raw.expressMinTime !== undefined) {
    const v = Number(raw.expressMinTime);
    if (!Number.isFinite(v) || v < 1) throw new Error("expressMinTime must be a positive number of minutes");
    payload.expressMinTime = Math.round(v);
  }
  if (raw.expressMaxTime !== undefined) {
    const v = Number(raw.expressMaxTime);
    if (!Number.isFinite(v) || v < 1) throw new Error("expressMaxTime must be a positive number of minutes");
    payload.expressMaxTime = Math.round(v);
  }

  if (typeof raw.expressTitle === "string" && raw.expressTitle.trim()) {
    payload.expressTitle = raw.expressTitle.trim();
  }
  if (typeof raw.slotTitle === "string" && raw.slotTitle.trim()) {
    payload.slotTitle = raw.slotTitle.trim();
  }

  if (raw.availableDays && typeof raw.availableDays === "object") {
    for (const day of DAY_KEYS) {
      if (typeof raw.availableDays[day] === "boolean") {
        payload[`availableDays.${day}`] = raw.availableDays[day];
      }
    }
  }

  return payload;
};

const validateSlotTimes = (startTime, endTime) => {
  if (!TIME_REGEX.test(String(startTime)) || !TIME_REGEX.test(String(endTime))) {
    throw new Error("Slot times must be in 24h HH:MM format (e.g. 09:00)");
  }
  if (toMinutes(endTime) <= toMinutes(startTime)) {
    throw new Error("Slot end time must be after start time");
  }
};

/* ===============================
   ADMIN — DELIVERY SETTINGS
================================ */

// GET /delivery-mode/admin/settings
export const getDeliverySettings = async (req, res) => {
  try {
    const settings = await DeliverySettings.getSingleton();
    return handleResponse(res, 200, "Delivery settings fetched", settings);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// PUT /delivery-mode/admin/settings
export const updateDeliverySettings = async (req, res) => {
  try {
    const payload = sanitizeSettingsPayload(req.body);

    if (Object.keys(payload).length === 0) {
      return handleResponse(res, 400, "No valid settings fields provided");
    }

    // Cross-field ETA validation against the resulting document state
    const current = await DeliverySettings.getSingleton();
    const min = payload.expressMinTime ?? current.expressMinTime;
    const max = payload.expressMaxTime ?? current.expressMaxTime;
    if (max <= min) {
      return handleResponse(res, 400, "Express max time must be greater than min time");
    }

    const settings = await DeliverySettings.findOneAndUpdate(
      { singletonKey: "global" },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );

    return handleResponse(res, 200, "Delivery settings updated", settings);
  } catch (error) {
    return handleResponse(res, 400, error.message);
  }
};

/* ===============================
   ADMIN — SLOT MANAGEMENT
================================ */

// GET /delivery-mode/admin/slots
export const getSlots = async (req, res) => {
  try {
    const slots = await DeliverySlot.find({})
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    return handleResponse(res, 200, "Slots fetched", slots);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /delivery-mode/admin/slots
export const createSlot = async (req, res) => {
  try {
    const { day = "all", startTime, endTime, enabled = true } = req.body;

    validateSlotTimes(startTime, endTime);
    if (day !== "all" && !DAY_KEYS.includes(day)) {
      return handleResponse(res, 400, "Invalid day value");
    }

    // Append at the end of the current ordering
    const last = await DeliverySlot.findOne({}).sort({ displayOrder: -1 }).select("displayOrder").lean();
    const displayOrder = (last?.displayOrder ?? -1) + 1;

    const slot = await DeliverySlot.create({
      day,
      startTime,
      endTime,
      enabled: Boolean(enabled),
      displayOrder,
    });

    return handleResponse(res, 201, "Slot created", slot);
  } catch (error) {
    return handleResponse(res, 400, error.message);
  }
};

// PUT /delivery-mode/admin/slots/:id
export const updateSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await DeliverySlot.findById(id);
    if (!existing) return handleResponse(res, 404, "Slot not found");

    const { day, startTime, endTime, enabled } = req.body;

    const nextStart = startTime ?? existing.startTime;
    const nextEnd = endTime ?? existing.endTime;
    validateSlotTimes(nextStart, nextEnd);

    if (day !== undefined) {
      if (day !== "all" && !DAY_KEYS.includes(day)) {
        return handleResponse(res, 400, "Invalid day value");
      }
      existing.day = day;
    }
    existing.startTime = nextStart;
    existing.endTime = nextEnd;
    if (typeof enabled === "boolean") existing.enabled = enabled;

    await existing.save();
    return handleResponse(res, 200, "Slot updated", existing);
  } catch (error) {
    return handleResponse(res, 400, error.message);
  }
};

// DELETE /delivery-mode/admin/slots/:id
export const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await DeliverySlot.findByIdAndDelete(id);
    if (!deleted) return handleResponse(res, 404, "Slot not found");
    return handleResponse(res, 200, "Slot deleted", deleted);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// PATCH /delivery-mode/admin/slots/:id/toggle
export const toggleSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const slot = await DeliverySlot.findById(id);
    if (!slot) return handleResponse(res, 404, "Slot not found");

    // Explicit value wins; otherwise flip current state
    slot.enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : !slot.enabled;
    await slot.save();

    return handleResponse(res, 200, `Slot ${slot.enabled ? "enabled" : "disabled"}`, slot);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// PUT /delivery-mode/admin/slots/reorder
// Body: { orderedIds: ["<slotId>", ...] } — full ordered list of slot ids
export const reorderSlots = async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return handleResponse(res, 400, "orderedIds array is required");
    }

    await DeliverySlot.bulkWrite(
      orderedIds.map((slotId, index) => ({
        updateOne: {
          filter: { _id: slotId },
          update: { $set: { displayOrder: index } },
        },
      })),
    );

    const slots = await DeliverySlot.find({})
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    return handleResponse(res, 200, "Slots reordered", slots);
  } catch (error) {
    return handleResponse(res, 400, error.message);
  }
};

/* ===============================
   USER — AVAILABLE DELIVERY MODES
================================ */

// GET /delivery-mode/options  (public — cart page reads this)
export const getAvailableDeliveryModes = async (req, res) => {
  try {
    const settings = await DeliverySettings.getSingleton();

    let slots = [];
    if (settings.slotEnabled) {
      slots = await DeliverySlot.find({ enabled: true })
        .sort({ displayOrder: 1, createdAt: 1 })
        .select("day startTime endTime displayOrder")
        .lean();
    }

    const availableDays = {};
    for (const day of DAY_KEYS) {
      availableDays[day] = settings.availableDays?.[day] !== false;
    }

    return handleResponse(res, 200, "Delivery modes fetched", {
      expressEnabled: settings.expressEnabled,
      slotEnabled: settings.slotEnabled && slots.length > 0,
      expressETA: `${settings.expressMinTime}-${settings.expressMaxTime} mins`,
      expressMinTime: settings.expressMinTime,
      expressMaxTime: settings.expressMaxTime,
      expressTitle: settings.expressTitle,
      slotTitle: settings.slotTitle,
      availableDays,
      slots,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
