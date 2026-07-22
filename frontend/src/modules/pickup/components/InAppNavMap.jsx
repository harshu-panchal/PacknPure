import React, { useMemo, useState, memo } from "react";
import { MapPin, Navigation } from "lucide-react";
import { cn } from "../utils/cn";
import { toLatLng } from "../utils/assignmentUtils";

const STOP_COLORS = {
  current: "0x0d9488",
  remaining: "0x94a3b8",
  completed: "0x22c55e",
  hub: "0x059669",
};

function buildMarkers(partnerLoc, targetLoc, stops = []) {
  const markers = [];
  if (partnerLoc) {
    markers.push(
      `markers=size:mid%7Ccolor:0x0d9488%7Clabel:P%7C${partnerLoc.lat},${partnerLoc.lng}`,
    );
  }

  for (const stop of stops) {
    const loc = toLatLng(stop.loc);
    if (!loc) continue;
    const color =
      stop.type === "hub"
        ? STOP_COLORS.hub
        : STOP_COLORS[stop.status] || STOP_COLORS.remaining;
    const label = stop.type === "hub" ? "H" : String(stop.label || "S").charAt(0).toUpperCase();
    markers.push(
      `markers=size:small%7Ccolor:${color}%7Clabel:${encodeURIComponent(label)}%7C${loc.lat},${loc.lng}`,
    );
  }

  if (targetLoc && !stops.some((s) => s.status === "current")) {
    const isHub = stops.some((s) => s.type === "hub" && s.status === "current");
    markers.push(
      `markers=size:mid%7Ccolor:${isHub ? STOP_COLORS.hub : STOP_COLORS.current}%7Clabel:T%7C${targetLoc.lat},${targetLoc.lng}`,
    );
  }

  return markers;
}

/**
 * In-app navigation map card for Pickup Partner (no external redirect).
 */
const InAppNavMap = ({
  partnerLoc,
  targetLoc,
  targetLabel = "SHOP",
  phaseLabel,
  distance,
  eta,
  stops = [],
}) => {
  const [imgError, setImgError] = useState(false);

  const stopSummary = useMemo(() => {
    const completed = stops.filter((s) => s.status === "completed").length;
    const remaining = stops.filter((s) => s.status === "remaining").length;
    return { completed, remaining, total: stops.length };
  }, [stops]);

  if (!partnerLoc) {
    return (
      <div className="flex min-h-[7rem] w-full min-w-0 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 sm:rounded-3xl">
        <MapPin className="mb-2 text-slate-300" size={22} />
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Enable GPS for in-app navigation
        </p>
      </div>
    );
  }

  if (!targetLoc) return null;

  const isHub = String(targetLabel).toUpperCase() === "HUB";
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const markerParams = buildMarkers(partnerLoc, targetLoc, stops);
  const pathParam =
    partnerLoc && targetLoc
      ? `path=color:0x0d9488aa%7Cweight:4%7C${partnerLoc.lat},${partnerLoc.lng}%7C${targetLoc.lat},${targetLoc.lng}`
      : "";

  const staticUrl = apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?size=640x320&scale=2&maptype=roadmap&${[...markerParams, pathParam].filter(Boolean).join("&")}&key=${apiKey}`
    : null;

  return (
    <div className="relative min-h-[10rem] w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-md sm:min-h-[12rem] sm:rounded-3xl">
      {staticUrl && !imgError ? (
        <img
          src={staticUrl}
          alt={`Route to ${targetLabel}`}
          className="h-full min-h-[10rem] w-full object-cover sm:min-h-[12rem]"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex min-h-[10rem] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-50 to-teal-50 px-4 py-6 text-center sm:min-h-[12rem]">
          <Navigation className="text-teal-600" size={28} />
          <p className="text-xs font-black uppercase tracking-widest text-slate-700">
            Navigating to {targetLabel}
          </p>
          <p className="max-w-full break-all text-[10px] font-medium text-slate-500">
            {partnerLoc.lat.toFixed(4)}, {partnerLoc.lng.toFixed(4)} →{" "}
            {targetLoc.lat.toFixed(4)}, {targetLoc.lng.toFixed(4)}
          </p>
          {stops.length > 0 && (
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {stopSummary.completed} done · {stopSummary.remaining} remaining
            </p>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/35 to-transparent p-3">
        <div className="rounded-lg bg-white/95 px-2.5 py-1 shadow-md backdrop-blur-sm">
          <p className="text-[8px] font-black uppercase leading-none text-slate-500">From</p>
          <p className="text-[10px] font-black uppercase leading-none text-teal-700">You</p>
        </div>
        <div
          className={cn(
            "rounded-lg border-b-2 bg-white/95 px-2.5 py-1 shadow-md backdrop-blur-sm",
            isHub ? "border-emerald-500" : "border-teal-500",
          )}
        >
          <p className="text-[8px] font-black uppercase leading-none text-slate-500">Next</p>
          <p
            className={cn(
              "max-w-[8rem] truncate text-[10px] font-black uppercase leading-none",
              isHub ? "text-emerald-600" : "text-teal-700",
            )}
          >
            {targetLabel}
          </p>
        </div>
      </div>

      {stops.length > 1 && (
        <div className="pointer-events-none absolute left-3 top-14 flex flex-wrap gap-1">
          {stops.slice(0, 5).map((s) => (
            <span
              key={s.id}
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase shadow-sm",
                s.status === "completed" && "bg-emerald-500 text-white",
                s.status === "current" && "bg-teal-600 text-white",
                s.status === "remaining" && "bg-white/90 text-slate-600",
              )}
            >
              {s.type === "hub" ? "Hub" : s.label?.slice(0, 8) || "Stop"}
            </span>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
        <div className="max-w-full rounded-xl border border-white/20 bg-slate-900/90 px-3 py-2 shadow-xl backdrop-blur-md">
          <p className="flex items-center justify-center gap-2 truncate text-[9px] font-black uppercase tracking-wider text-white sm:text-[10px] sm:tracking-[0.15em]">
            <span
              className={cn(
                "pickup-pulse-dot h-2 w-2 shrink-0 rounded-full",
                isHub
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]",
              )}
            />
            <span className="truncate">
              {phaseLabel || (isHub ? "Delivering to Hub" : "Heading to Vendor")}
              {distance ? ` · ${distance}` : ""}
              {eta ? ` · ETA ${eta}` : ""}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default memo(InAppNavMap);
