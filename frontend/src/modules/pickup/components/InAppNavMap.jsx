import React from "react";
import { MapPin, Navigation } from "lucide-react";

/**
 * In-app navigation map for Pickup App only (no external Google Maps redirect).
 */
const InAppNavMap = ({ partnerLoc, targetLoc, targetLabel = "SHOP", phaseLabel }) => {
  if (!partnerLoc) {
    return (
      <div className="flex h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
        <MapPin className="mb-1 text-slate-300" size={20} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Enable GPS for in-app navigation
        </p>
      </div>
    );
  }

  if (!targetLoc) return null;

  const isHub = String(targetLabel).toUpperCase() === "HUB";
  const targetColor = isHub ? "0x10b981" : "0xe11d48";
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  const staticUrl = apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?size=800x400&maptype=roadmap&markers=size:mid%7Ccolor:0x4f46e5%7Clabel:P%7C${partnerLoc.lat},${partnerLoc.lng}&markers=size:mid%7Ccolor:${targetColor}%7Clabel:T%7C${targetLoc.lat},${targetLoc.lng}&path=color:0x4f46e5aa%7Cweight:5%7C${partnerLoc.lat},${partnerLoc.lng}%7C${targetLoc.lat},${targetLoc.lng}&key=${apiKey}`
    : null;

  return (
    <div className="relative h-56 w-full overflow-hidden rounded-[32px] border-4 border-white bg-slate-200 shadow-2xl">
      {staticUrl ? (
        <img src={staticUrl} alt="In-app route" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-indigo-50 px-6 text-center">
          <Navigation className="text-indigo-500" size={28} />
          <p className="text-xs font-black uppercase tracking-widest text-slate-700">
            Navigating to {targetLabel}
          </p>
          <p className="text-[10px] font-semibold text-slate-500">
            You {partnerLoc.lat.toFixed(4)}, {partnerLoc.lng.toFixed(4)} →{" "}
            {targetLoc.lat.toFixed(4)}, {targetLoc.lng.toFixed(4)}
          </p>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/40 to-transparent p-4">
        <div className="rounded-lg bg-white/95 px-3 py-1 shadow-lg backdrop-blur">
          <p className="mb-1 text-[8px] font-black uppercase leading-none text-slate-500">From</p>
          <p className="text-[10px] font-black uppercase leading-none text-indigo-600">You</p>
        </div>
        <div
          className={`rounded-lg border-b-2 bg-white/95 px-3 py-1 shadow-lg backdrop-blur ${
            isHub ? "border-emerald-500" : "border-rose-500"
          }`}
        >
          <p className="mb-1 text-[8px] font-black uppercase leading-none text-slate-500">Next</p>
          <p
            className={`text-[10px] font-black uppercase leading-none ${
              isHub ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {targetLabel}
          </p>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 flex justify-center">
        <div className="rounded-2xl border border-white/20 bg-slate-900/90 px-4 py-2 shadow-2xl backdrop-blur-xl">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[2px] text-white">
            <span
              className={`h-2 w-2 animate-pulse rounded-full ${
                isHub
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                  : "bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.8)]"
              }`}
            />
            {phaseLabel || (isHub ? "Phase 2: Delivering to Hub" : "Phase 1: Heading to Vendor")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default InAppNavMap;
