import React from "react";
import { CheckCircle2, Clock, Truck, FileCheck, XCircle, AlertTriangle } from "lucide-react";

export const ManualPRTimeline = ({ timeline = [], createdAt, dates = {} }) => {
  const steps = [
    { label: "Request Created", date: createdAt, icon: Clock, color: "text-indigo-600 bg-indigo-50" },
    { label: "Vendor Response", date: dates.confirmedAt || dates.rejectedAt, icon: CheckCircle2, color: dates.rejectedAt ? "text-rose-600 bg-rose-50" : "text-emerald-600 bg-emerald-50" },
    { label: "Pickup Assigned", date: dates.pickupAssignedAt, icon: Truck, color: "text-blue-600 bg-blue-50" },
    { label: "Picked Up", date: dates.pickedAt, icon: Truck, color: "text-amber-600 bg-amber-50" },
    { label: "Received at Hub", date: dates.receivedAtHub, icon: FileCheck, color: "text-purple-600 bg-purple-50" },
    { label: "QA Inspected", date: dates.verifiedAt, icon: FileCheck, color: "text-emerald-600 bg-emerald-50" }
  ];

  return (
    <div className="relative pl-6 border-l-2 border-slate-100 space-y-5">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const active = !!step.date;

        return (
          <div key={idx} className="relative">
            <div className={`absolute -left-[33px] top-0.5 p-1 rounded-full border border-white shrink-0 ${active ? step.color : "text-slate-300 bg-slate-50"}`}>
              <Icon size={12} />
            </div>
            <div>
              <p className={`text-xs font-bold ${active ? "text-slate-800" : "text-slate-400"}`}>
                {step.label}
              </p>
              {active ? (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {new Date(step.date).toLocaleString()}
                </p>
              ) : (
                <p className="text-[10px] text-slate-300 mt-0.5 font-medium">Pending</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ManualPRTimeline;
