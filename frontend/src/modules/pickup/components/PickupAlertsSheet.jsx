import React from "react";
import { Bell, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { PickupBottomSheet } from "./ui";
import { formatPrDate } from "@shared/utils/purchaseRequestFormat";

const iconFor = (type) => {
  if (type === "success") return CheckCircle;
  if (type === "otp") return Info;
  if (type === "warning") return AlertTriangle;
  return Bell;
};

const PickupAlertsSheet = ({ open, onClose, alerts, onMarkAllRead }) => (
  <PickupBottomSheet open={open} onClose={onClose} title="Alerts">
    {alerts.length === 0 ? (
      <p className="py-8 text-center text-sm text-slate-400">No alerts yet</p>
    ) : (
      <>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="mb-3 text-[10px] font-bold uppercase tracking-widest text-teal-600"
        >
          Mark all read
        </button>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {alerts.map((a) => {
            const Icon = iconFor(a.type);
            return (
              <div
                key={a.id}
                className={`flex gap-3 rounded-2xl p-3 ${a.read ? "bg-slate-50" : "bg-teal-50/80 ring-1 ring-teal-100"}`}
              >
                <Icon size={18} className="mt-0.5 shrink-0 text-teal-600" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">{a.title}</p>
                  <p className="text-[11px] text-slate-600">{a.message}</p>
                  <p className="mt-1 text-[9px] text-slate-400">{formatPrDate(a.at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </>
    )}
  </PickupBottomSheet>
);

export default PickupAlertsSheet;
