import React from "react";
import { Star, Truck, MessageSquare } from "lucide-react";
import MaskedCallButton from "@/shared/components/delivery/MaskedCallButton";
import { customerApi } from "@/modules/customer/services/customerApi";
import { cn } from "@/lib/utils";

const VEHICLE_ICONS = {
  bike: "🏍️",
  cycle: "🚲",
  scooter: "🛵",
};

export default function DeliveryPartnerCard({
  partner,
  orderId,
  etaText = "—",
  arrivingInText = "—",
  distanceText = "—",
  isActive = true,
  className,
}) {
  if (!partner) return null;

  const name = partner.name || "Delivery Partner";
  const rating = Number(partner.rating) || 4.8;
  const vehicleType = partner.vehicleTypeLabel || partner.vehicleType || "Motorcycle";
  const vehicleNumber = partner.vehicleNumber || null;
  const photo = partner.profileImage || null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start gap-3 p-4 sm:p-5">
        <div className="relative shrink-0">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-md ring-2 ring-rose-100">
            {photo ? (
              <img src={photo} alt={name} className="h-full w-full object-cover" />
            ) : (
              <Truck size={28} className="text-[#E23744]" />
            )}
          </div>
          <span className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full bg-[#E23744] px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
            {rating.toFixed(1)} <Star size={8} fill="white" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Delivery partner
          </p>
          <h3 className="truncate text-base font-black text-slate-900 sm:text-lg">{name}</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {VEHICLE_ICONS[partner.vehicleType] || "🛵"} {vehicleType}
            {vehicleNumber ? ` · ${vehicleNumber}` : ""}
          </p>
        </div>

        {isActive && (
          <div className="w-full shrink-0 text-right sm:w-auto">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ETA</p>
            <p className="text-lg font-black text-[#E23744]">{arrivingInText}</p>
            <p className="text-xs font-semibold text-slate-500">
              {etaText} · {distanceText}
            </p>
          </div>
        )}
      </div>

      {isActive && orderId && (
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center">
          <MaskedCallButton
            orderId={orderId}
            role="customer"
            initiateCall={(id) => customerApi.initiateMaskedCall(id)}
            className="flex-1"
          />
          <button
            type="button"
            disabled
            title="Chat coming soon"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-400"
          >
            <MessageSquare size={18} />
            Chat
          </button>
        </div>
      )}
    </div>
  );
}
