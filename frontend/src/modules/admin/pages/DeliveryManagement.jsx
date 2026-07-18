import React, { useEffect, useState } from "react";
import { adminApi } from "../services/adminApi";
import { toast } from "sonner";
import {
  Zap,
  CalendarClock,
  Plus,
  Trash2,
  Edit3,
  Save,
  ArrowUp,
  ArrowDown,
  Timer,
  CalendarDays,
} from "lucide-react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Modal from "@shared/components/ui/Modal";
import { cn } from "@/lib/utils";

/**
 * Delivery Management (Admin)
 *
 * Controls the Delivery Mode feature shown on the customer cart page:
 * - Delivery Settings: enable/disable Express & Slot delivery, express ETA,
 *   card labels and weekday availability.
 * - Slot Management: create/edit/delete/enable/disable/reorder time slots.
 *
 * Changes reflect in the user app immediately (the app fetches
 * /delivery-mode/options with a very short cache).
 */

const DAYS = [
  { key: "sunday", label: "Sunday" },
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
];

const EMPTY_SLOT_FORM = { day: "all", startTime: "09:00", endTime: "12:00", enabled: true };

/** "09:00" -> "9:00 AM" */
const formatTime = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
};

/** Small reusable pill-style on/off switch matching the admin design language */
const ToggleSwitch = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
      checked ? "bg-emerald-500" : "bg-slate-200",
    )}
  >
    <span
      className={cn(
        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
        checked ? "left-[22px]" : "left-0.5",
      )}
    />
  </button>
);

const DeliveryManagement = () => {
  const [activeTab, setActiveTab] = useState("settings");
  const [isLoading, setIsLoading] = useState(true);

  // Delivery settings state
  const [settings, setSettings] = useState({
    expressEnabled: true,
    slotEnabled: true,
    expressMinTime: 30,
    expressMaxTime: 60,
    expressTitle: "Express Delivery",
    slotTitle: "Slot Delivery",
    availableDays: DAYS.reduce((acc, d) => ({ ...acc, [d.key]: true }), {}),
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Slot management state
  const [slots, setSlots] = useState([]);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT_FORM);
  const [isSavingSlot, setIsSavingSlot] = useState(false);
  const [deletingSlot, setDeletingSlot] = useState(null);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [settingsRes, slotsRes] = await Promise.all([
        adminApi.getDeliverySettings(),
        adminApi.getDeliverySlots(),
      ]);
      const s = settingsRes.data?.result;
      if (s) {
        setSettings({
          expressEnabled: s.expressEnabled ?? true,
          slotEnabled: s.slotEnabled ?? true,
          expressMinTime: s.expressMinTime ?? 30,
          expressMaxTime: s.expressMaxTime ?? 60,
          expressTitle: s.expressTitle || "Express Delivery",
          slotTitle: s.slotTitle || "Slot Delivery",
          availableDays: DAYS.reduce(
            (acc, d) => ({ ...acc, [d.key]: s.availableDays?.[d.key] !== false }),
            {},
          ),
        });
      }
      setSlots(slotsRes.data?.results || []);
    } catch (error) {
      console.error("Failed to load delivery configuration:", error);
      toast.error("Failed to load delivery configuration");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  /* ---------- Delivery Settings actions ---------- */

  const handleSaveSettings = async () => {
    if (Number(settings.expressMaxTime) <= Number(settings.expressMinTime)) {
      toast.error("Express max time must be greater than min time");
      return;
    }
    setIsSavingSettings(true);
    try {
      await adminApi.updateDeliverySettings({
        expressEnabled: settings.expressEnabled,
        slotEnabled: settings.slotEnabled,
        expressMinTime: Number(settings.expressMinTime),
        expressMaxTime: Number(settings.expressMaxTime),
        expressTitle: settings.expressTitle,
        slotTitle: settings.slotTitle,
        availableDays: settings.availableDays,
      });
      toast.success("Delivery settings updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save delivery settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  /* ---------- Slot Management actions ---------- */

  const openCreateSlot = () => {
    setEditingSlot(null);
    setSlotForm(EMPTY_SLOT_FORM);
    setIsSlotModalOpen(true);
  };

  const openEditSlot = (slot) => {
    setEditingSlot(slot);
    setSlotForm({
      day: slot.day || "all",
      startTime: slot.startTime,
      endTime: slot.endTime,
      enabled: slot.enabled !== false,
    });
    setIsSlotModalOpen(true);
  };

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    if (!slotForm.startTime || !slotForm.endTime) {
      toast.error("Start and end time are required");
      return;
    }
    if (slotForm.endTime <= slotForm.startTime) {
      toast.error("End time must be after start time");
      return;
    }
    setIsSavingSlot(true);
    try {
      if (editingSlot) {
        await adminApi.updateDeliverySlot(editingSlot._id, slotForm);
        toast.success("Slot updated");
      } else {
        await adminApi.createDeliverySlot(slotForm);
        toast.success("Slot created");
      }
      setIsSlotModalOpen(false);
      setEditingSlot(null);
      await fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save slot");
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleToggleSlot = async (slot) => {
    try {
      const { data } = await adminApi.toggleDeliverySlot(slot._id, !slot.enabled);
      const updated = data?.result;
      setSlots((prev) =>
        prev.map((s) => (s._id === slot._id ? { ...s, enabled: updated?.enabled ?? !slot.enabled } : s)),
      );
      toast.success(`Slot ${slot.enabled ? "disabled" : "enabled"}`);
    } catch (error) {
      toast.error("Failed to update slot status");
    }
  };

  const handleDeleteSlot = async () => {
    if (!deletingSlot) return;
    try {
      await adminApi.deleteDeliverySlot(deletingSlot._id);
      setSlots((prev) => prev.filter((s) => s._id !== deletingSlot._id));
      toast.success("Slot deleted");
    } catch (error) {
      toast.error("Failed to delete slot");
    } finally {
      setDeletingSlot(null);
    }
  };

  const handleMoveSlot = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= slots.length) return;

    const reordered = [...slots];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setSlots(reordered); // optimistic update

    try {
      await adminApi.reorderDeliverySlots(reordered.map((s) => s._id));
    } catch (error) {
      toast.error("Failed to reorder slots");
      fetchAll(); // restore server order on failure
    }
  };

  const dayLabel = (dayKey) =>
    dayKey === "all" ? "Every day" : DAYS.find((d) => d.key === dayKey)?.label || dayKey;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="ds-h1 flex items-center gap-3">
            Delivery Management
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Timer className="h-5 w-5 text-indigo-600" />
            </div>
          </h1>
          <p className="ds-description mt-1">
            Control Express &amp; Slot delivery shown on the customer cart page.
          </p>
        </div>
        {activeTab === "slots" && (
          <button
            onClick={openCreateSlot}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 shadow-indigo-200"
          >
            <Plus className="h-4 w-4" />
            ADD SLOT
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex w-fit bg-slate-100 p-1 rounded-2xl">
        {[
          { id: "settings", label: "Delivery Settings", icon: Zap },
          { id: "slots", label: "Slot Management", icon: CalendarClock },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeTab === tab.id
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== DELIVERY SETTINGS TAB ==================== */}
      {activeTab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Express Delivery card */}
          <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-xl text-left space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 rounded-xl">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Express Delivery</h3>
                  <p className="text-xs text-slate-400 font-medium">Fast delivery within an ETA window</p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.expressEnabled}
                onChange={(v) => setSettings((prev) => ({ ...prev, expressEnabled: v }))}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Card label
              </label>
              <input
                type="text"
                value={settings.expressTitle}
                onChange={(e) => setSettings((prev) => ({ ...prev, expressTitle: e.target.value }))}
                placeholder="Express Delivery"
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  ETA min (mins)
                </label>
                <input
                  type="number"
                  min={1}
                  value={settings.expressMinTime}
                  onChange={(e) => setSettings((prev) => ({ ...prev, expressMinTime: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  ETA max (mins)
                </label>
                <input
                  type="number"
                  min={1}
                  value={settings.expressMaxTime}
                  onChange={(e) => setSettings((prev) => ({ ...prev, expressMaxTime: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>
            </div>

            <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-3 font-medium">
              Customers will see: <span className="font-bold text-slate-700">
                "Delivery within {settings.expressMinTime}-{settings.expressMaxTime} mins"
              </span>
            </p>
          </Card>

          {/* Slot Delivery card */}
          <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-xl text-left space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-50 rounded-xl">
                  <CalendarClock className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Slot Delivery</h3>
                  <p className="text-xs text-slate-400 font-medium">Customer picks a date &amp; time slot</p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.slotEnabled}
                onChange={(v) => setSettings((prev) => ({ ...prev, slotEnabled: v }))}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Card label
              </label>
              <input
                type="text"
                value={settings.slotTitle}
                onChange={(e) => setSettings((prev) => ({ ...prev, slotTitle: e.target.value }))}
                placeholder="Slot Delivery"
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" />
                Available days
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const active = settings.availableDays[day.key];
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          availableDays: {
                            ...prev.availableDays,
                            [day.key]: !prev.availableDays[day.key],
                          },
                        }))
                      }
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                        active
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200",
                      )}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-400 font-medium">
                Disabled days are hidden from the slot picker in the user app.
              </p>
            </div>
          </Card>

          {/* Save */}
          <div className="lg:col-span-2">
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSavingSettings ? "SAVING..." : "SAVE DELIVERY SETTINGS"}
            </button>
          </div>
        </div>
      )}

      {/* ==================== SLOT MANAGEMENT TAB ==================== */}
      {activeTab === "slots" && (
        <Card className="border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden text-left">
          {slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-slate-50 rounded-2xl mb-4">
                <CalendarClock className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-sm font-black text-slate-900 mb-1">No slots yet</h3>
              <p className="text-xs text-slate-400 font-medium mb-4">
                Create your first delivery time slot (e.g. 09:00 - 12:00).
              </p>
              <button
                onClick={openCreateSlot}
                className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all"
              >
                <Plus className="h-4 w-4" />
                ADD SLOT
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Slot</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Day</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot, index) => (
                    <tr key={slot._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveSlot(index, -1)}
                            disabled={index === 0}
                            title="Move up"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSlot(index, 1)}
                            disabled={index === slots.length - 1}
                            title="Move down"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <span className="ml-1 text-xs font-bold text-slate-400">#{index + 1}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-black text-slate-900">
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-medium">
                          {slot.startTime} - {slot.endTime}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className="text-[9px] font-black uppercase tracking-widest border-slate-200 text-slate-500"
                        >
                          {dayLabel(slot.day)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <ToggleSwitch
                            checked={slot.enabled !== false}
                            onChange={() => handleToggleSlot(slot)}
                          />
                          <span
                            className={cn(
                              "text-[10px] font-black uppercase tracking-widest",
                              slot.enabled !== false ? "text-emerald-600" : "text-slate-400",
                            )}
                          >
                            {slot.enabled !== false ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditSlot(slot)}
                            className="p-2 transition-all text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeletingSlot(slot)}
                            className="p-2 transition-all text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Create / Edit Slot Modal */}
      <Modal
        isOpen={isSlotModalOpen}
        onClose={() => {
          setIsSlotModalOpen(false);
          setEditingSlot(null);
        }}
        title={editingSlot ? "Edit Slot" : "Create New Slot"}
      >
        <form onSubmit={handleSaveSlot} className="space-y-5 text-left">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Applies to
            </label>
            <select
              value={slotForm.day}
              onChange={(e) => setSlotForm((prev) => ({ ...prev, day: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer"
            >
              <option value="all">Every day</option>
              {DAYS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label} only
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Start time
              </label>
              <input
                type="time"
                required
                value={slotForm.startTime}
                onChange={(e) => setSlotForm((prev) => ({ ...prev, startTime: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                End time
              </label>
              <input
                type="time"
                required
                value={slotForm.endTime}
                onChange={(e) => setSlotForm((prev) => ({ ...prev, endTime: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span className="text-xs font-bold text-slate-700">Enabled</span>
            <ToggleSwitch
              checked={slotForm.enabled}
              onChange={(v) => setSlotForm((prev) => ({ ...prev, enabled: v }))}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setIsSlotModalOpen(false);
                setEditingSlot(null);
              }}
              className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSavingSlot}
              className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSavingSlot ? "SAVING..." : editingSlot ? "UPDATE SLOT" : "CREATE SLOT"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingSlot)}
        onClose={() => setDeletingSlot(null)}
        title="Delete Slot"
      >
        <div className="space-y-5 text-left">
          <p className="text-sm font-medium text-slate-600">
            Are you sure you want to delete the slot{" "}
            <span className="font-black text-slate-900">
              {deletingSlot ? `${formatTime(deletingSlot.startTime)} - ${formatTime(deletingSlot.endTime)}` : ""}
            </span>
            ? It will immediately stop showing in the user app.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDeletingSlot(null)}
              className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleDeleteSlot}
              className="flex-1 py-3.5 bg-rose-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-rose-700 transition-all"
            >
              DELETE
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DeliveryManagement;
