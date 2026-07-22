import React from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, ChevronRight } from "lucide-react";
import { PickupCard } from "./ui";
import { formatEta } from "../utils/assignmentUtils";

const TripOverviewCard = ({ trip, hubName }) => {
  if (!trip?.hasActiveTrip) return null;

  const { current, nextSeller, mode, progressPct, estimatedFinish, pendingSellers, pickedAwaitingHub, completed } = trip;

  const destName =
    mode === "hub"
      ? hubName || "Hub"
      : current?.vendor?.name || "Seller";

  const nextName =
    mode === "seller" && nextSeller
      ? nextSeller.vendor?.name
      : mode === "seller" && pickedAwaitingHub.length
        ? hubName || "Hub"
        : null;

  const eta = formatEta(current?.eta || current?.dates?.eta);
  const finishEta = formatEta(estimatedFinish);

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
      <PickupCard padding="md" className="space-y-4 border-teal-100 bg-gradient-to-br from-white to-teal-50/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">
              Active trip
            </p>
            <p className="truncate text-lg font-black text-slate-900">{destName}</p>
            <p className="text-[10px] font-semibold text-slate-500">
              {mode === "hub" ? "Hub delivery" : `Seller ${trip.currentIndex} of ${trip.sellersTotal}`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-black text-teal-600">{progressPct}%</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Progress</p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/80 px-2 py-2">
            <p className="text-lg font-black text-emerald-600">{completed.length}</p>
            <p className="text-[8px] font-bold uppercase text-slate-400">Done</p>
          </div>
          <div className="rounded-xl bg-white/80 px-2 py-2 ring-2 ring-teal-400">
            <p className="text-lg font-black text-teal-600">1</p>
            <p className="text-[8px] font-bold uppercase text-slate-400">Current</p>
          </div>
          <div className="rounded-xl bg-white/80 px-2 py-2">
            <p className="text-lg font-black text-amber-600">{pendingSellers.length + (mode === "hub" ? 0 : pickedAwaitingHub.length)}</p>
            <p className="text-[8px] font-bold uppercase text-slate-400">Left</p>
          </div>
        </div>

        {(eta || nextName || finishEta) && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-600">
            {eta && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1">
                <Navigation size={10} aria-hidden /> ETA {eta}
              </span>
            )}
            {finishEta && finishEta !== eta && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1">
                Finish ~{finishEta}
              </span>
            )}
            {nextName && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1">
                Next <ChevronRight size={10} /> {nextName}
              </span>
            )}
          </div>
        )}

        {pendingSellers.length > 1 && (
          <div className="space-y-1 border-t border-slate-100 pt-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Remaining sellers
            </p>
            {pendingSellers.slice(1, 4).map((s, i) => (
              <p key={s._id} className="flex items-center gap-2 truncate text-xs text-slate-600">
                <MapPin size={10} className="shrink-0 text-slate-300" />
                {i + 2}. {s.vendor?.name || "Seller"}
              </p>
            ))}
            {pendingSellers.length > 4 && (
              <p className="text-[10px] text-slate-400">+{pendingSellers.length - 4} more</p>
            )}
          </div>
        )}
      </PickupCard>
    </motion.div>
  );
};

export default TripOverviewCard;
