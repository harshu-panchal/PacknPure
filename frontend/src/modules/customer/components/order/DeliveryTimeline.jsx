import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Package,
  UserCheck,
  Building2,
  ShoppingBag,
  Truck,
  MapPin,
  KeyRound,
  Home,
  CheckCircle,
  Circle,
  Loader2,
} from "lucide-react";
import { customerApi } from "@/modules/customer/services/customerApi";
import { cn } from "@/lib/utils";

const STEP_ICONS = {
  packed: Package,
  delivery_assigned: UserCheck,
  reached_hub: Building2,
  picked: ShoppingBag,
  out_for_delivery: Truck,
  nearby: MapPin,
  otp_verification: KeyRound,
  delivered: Home,
};

function formatStepTime(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return null;
  }
}

export default function DeliveryTimeline({
  orderId,
  initialTimeline = null,
  deliveryOtp = null,
  className,
  pollMs = 12000,
}) {
  const [timeline, setTimeline] = useState(initialTimeline);
  const [loading, setLoading] = useState(!initialTimeline);

  useEffect(() => {
    if (initialTimeline) {
      setTimeline(initialTimeline);
      setLoading(false);
    }
  }, [initialTimeline]);

  useEffect(() => {
    if (!orderId) return undefined;

    const fetchTimeline = () => {
      customerApi
        .getDeliveryTimeline(orderId)
        .then((r) => setTimeline(r.data?.result || r.data?.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    };

    fetchTimeline();
    const iv = setInterval(fetchTimeline, pollMs);
    return () => clearInterval(iv);
  }, [orderId, pollMs]);

  const steps = timeline?.steps || [];

  if (loading && !steps.length) {
    return (
      <div className={cn("flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-8", className)}>
        <Loader2 className="animate-spin text-[#E23744]" size={24} />
      </div>
    );
  }

  if (!steps.length) return null;

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}>
      <h3 className="mb-4 text-sm font-black text-slate-900">Delivery timeline</h3>
      <div className="space-y-0">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[step.id] || Circle;
          const isCompleted = step.status === "completed";
          const isActive = step.status === "active";
          const timeLabel = formatStepTime(step.timestamp);

          return (
            <div key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "absolute left-[17px] top-9 bottom-0 w-0.5",
                    isCompleted ? "bg-[#E23744]" : "bg-slate-200",
                  )}
                />
              )}
              <motion.div
                initial={false}
                animate={{ scale: isActive ? 1.05 : 1 }}
                className={cn(
                  "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2",
                  isCompleted
                    ? "border-[#E23744] bg-[#E23744] text-white"
                    : isActive
                    ? "border-amber-400 bg-amber-50 text-amber-600"
                    : "border-slate-200 bg-slate-50 text-slate-400",
                )}
              >
                {isCompleted ? <CheckCircle size={18} /> : <Icon size={16} />}
              </motion.div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p
                    className={cn(
                      "text-sm font-bold",
                      isCompleted ? "text-slate-900" : isActive ? "text-amber-800" : "text-slate-400",
                    )}
                  >
                    {step.label}
                  </p>
                  {timeLabel && (
                    <span className="text-[11px] font-semibold text-slate-400">{timeLabel}</span>
                  )}
                </div>
                {isActive && (
                  <p className="mt-0.5 text-xs font-medium text-amber-600">In progress…</p>
                )}
                {deliveryOtp &&
                  !isCompleted &&
                  isActive &&
                  (step.id === "nearby" || step.id === "otp_verification") && (
                  <div className="mt-2 rounded-xl border border-[#E23744]/25 bg-rose-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#E23744]">
                      Your delivery OTP
                    </p>
                    <p className="mt-0.5 font-mono text-2xl font-black tracking-[0.3em] text-slate-900">
                      {deliveryOtp}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Share this code with your delivery partner
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
