import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import {
  MapPin,
  Navigation,
  Loader2,
  ExternalLink,
  Crosshair,
} from "lucide-react";
import { cn } from "../utils/cn";
import { toLatLng, formatDistance } from "../utils/assignmentUtils";
import deliveryIcon from "@/assets/deliveryIcon.png";
import storePin from "@/assets/store-pin.png";

const libraries = ["places", "geometry"];

const containerStyle = {
  width: "100%",
  height: "100%",
  minHeight: "260px",
};

const AVG_SPEED_KMH = 24;

function openExternalMaps(origin, destination) {
  if (!destination) return;
  const dest = `${destination.lat},${destination.lng}`;
  const originParam =
    origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)
      ? `&origin=${origin.lat},${origin.lng}`
      : "";
  const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${dest}&travelmode=driving`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function estimateMinutesFromMeters(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return null;
  return Math.max(1, Math.round((meters / 1000 / AVG_SPEED_KMH) * 60));
}

function formatArrivalClock(minutesFromNow) {
  if (!Number.isFinite(minutesFromNow)) return "—";
  const d = new Date(Date.now() + minutesFromNow * 60 * 1000);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Interactive Google Map for Pickup Partner navigation.
 * Partner pin + destination pin + road route (Directions API) + ETA card.
 */
const InAppNavMap = ({
  partnerLoc,
  targetLoc,
  targetLabel = "SHOP",
  phaseLabel,
  distance: distanceProp,
  eta: etaProp,
  stops = [],
}) => {
  const mapRef = useRef(null);
  const polylineRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [routeMeta, setRouteMeta] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [directionsError, setDirectionsError] = useState(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const isHub =
    String(targetLabel).toUpperCase() === "HUB" ||
    String(targetLabel).toLowerCase().includes("hub");

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries,
  });

  const rider = useMemo(() => {
    if (!partnerLoc) return null;
    const lat = Number(partnerLoc.lat);
    const lng = Number(partnerLoc.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [partnerLoc]);

  const dest = useMemo(() => {
    if (!targetLoc) return null;
    const lat = Number(targetLoc.lat);
    const lng = Number(targetLoc.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [targetLoc]);

  const riderIcon = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return undefined;
    return {
      url: deliveryIcon,
      scaledSize: new window.google.maps.Size(44, 64),
      anchor: new window.google.maps.Point(22, 64),
    };
  }, [isLoaded]);

  const destIcon = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return undefined;
    return {
      url: storePin,
      scaledSize: new window.google.maps.Size(40, 52),
      anchor: new window.google.maps.Point(20, 52),
    };
  }, [isLoaded]);

  const mapCenter = rider || dest || { lat: 22.7196, lng: 75.8577 };

  const clearPolyline = useCallback(() => {
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
  }, []);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    setMapInstance(map);
  }, []);

  const fitBounds = useCallback(
    (path) => {
      const map = mapRef.current || mapInstance;
      if (!map || !window.google?.maps) return;
      const bounds = new window.google.maps.LatLngBounds();
      if (rider) bounds.extend(rider);
      if (dest) bounds.extend(dest);
      if (Array.isArray(path)) {
        path.forEach((p) => bounds.extend(p));
      }
      for (const stop of stops) {
        const loc = toLatLng(stop.loc);
        if (loc) bounds.extend(loc);
      }
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
      }
    },
    [rider, dest, stops, mapInstance],
  );

  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !rider) return;
    map.panTo(rider);
    map.setZoom(15);
  }, [rider]);

  // Fetch road route via client DirectionsService (no backend change)
  useEffect(() => {
    if (!isLoaded || !mapInstance || !rider || !dest || !window.google?.maps) {
      return undefined;
    }

    let cancelled = false;
    setRouteLoading(true);
    setDirectionsError(null);

    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin: rider,
        destination: dest,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (cancelled) return;
        setRouteLoading(false);

        clearPolyline();

        if (status !== "OK" || !result?.routes?.[0]) {
          setDirectionsError(
            status === "REQUEST_DENIED"
              ? "Enable Directions API + billing for your Maps key"
              : "Route unavailable — use Navigate for turn-by-turn",
          );
          setRouteMeta(null);
          fitBounds();
          return;
        }

        const route = result.routes[0];
        const leg = route.legs?.[0];
        const path = route.overview_path || [];

        const pl = new window.google.maps.Polyline({
          path,
          strokeColor: isHub ? "#059669" : "#0d9488",
          strokeOpacity: 0.95,
          strokeWeight: 5,
          map: mapInstance,
        });
        polylineRef.current = pl;

        setRouteMeta({
          durationSeconds: leg?.duration?.value ?? null,
          distanceMeters: leg?.distance?.value ?? null,
          durationText: leg?.duration?.text || null,
          distanceText: leg?.distance?.text || null,
        });

        fitBounds(path);
      },
    );

    return () => {
      cancelled = true;
      clearPolyline();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when endpoints move
  }, [isLoaded, mapInstance, rider?.lat, rider?.lng, dest?.lat, dest?.lng, isHub]);

  const minutes =
    routeMeta?.durationSeconds != null
      ? Math.max(1, Math.round(routeMeta.durationSeconds / 60))
      : estimateMinutesFromMeters(routeMeta?.distanceMeters);

  const distanceLabel =
    routeMeta?.distanceText ||
    (routeMeta?.distanceMeters != null
      ? formatDistance(routeMeta.distanceMeters)
      : distanceProp) ||
    null;

  const arrivalClock = minutes != null ? formatArrivalClock(minutes) : etaProp || "—";
  const arrivingIn =
    minutes != null ? `${minutes} min${minutes === 1 ? "" : "s"}` : etaProp || "—";

  if (!dest) return null;

  if (!apiKey) {
    return (
      <div className="space-y-3">
        <div className="flex min-h-[12rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center sm:rounded-3xl">
          <MapPin className="text-slate-300" size={22} />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Set VITE_GOOGLE_MAPS_API_KEY for live map
          </p>
          <button
            type="button"
            onClick={() => openExternalMaps(rider, dest)}
            className="mt-1 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-teal-600 px-4 text-[10px] font-black uppercase tracking-widest text-white"
          >
            <ExternalLink size={14} /> Open in Google Maps
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-2xl bg-rose-50 px-4 text-center text-xs font-semibold text-rose-700 sm:rounded-3xl">
        Map failed to load. Check API key and billing.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-2xl bg-slate-50 sm:rounded-3xl">
        <Loader2 className="animate-spin text-teal-600" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="relative h-[280px] w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-md sm:h-[340px] sm:rounded-3xl"
        data-lenis-prevent
        data-lenis-prevent-touch="true"
      >
        {!rider && (
          <div className="absolute inset-x-0 top-0 z-10 bg-amber-50/95 px-3 py-2 text-center text-[10px] font-semibold text-amber-900">
            Enable GPS to show your live location on the map
          </div>
        )}

        {directionsError && (
          <div className="absolute inset-x-2 top-2 z-10 max-w-[90%] rounded-lg border border-amber-200 bg-amber-50/95 px-2 py-1.5 text-[10px] leading-snug text-amber-900">
            {directionsError}
          </div>
        )}

        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={14}
          onLoad={onMapLoad}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: "greedy",
          }}
        >
          {rider && (
            <Marker position={rider} title="You" icon={riderIcon} />
          )}
          {dest && (
            <Marker
              position={dest}
              title={targetLabel}
              icon={destIcon}
            />
          )}
          {stops
            .filter((s) => s.status !== "current" && s.id !== "hub")
            .slice(0, 6)
            .map((s) => {
              const loc = toLatLng(s.loc);
              if (!loc) return null;
              return (
                <Marker
                  key={s.id}
                  position={loc}
                  title={s.label || "Stop"}
                  opacity={s.status === "completed" ? 0.55 : 0.85}
                  label={{
                    text: s.status === "completed" ? "✓" : String((s.label || "S")[0]).toUpperCase(),
                    color: "#0f172a",
                    fontSize: "10px",
                    fontWeight: "700",
                  }}
                />
              );
            })}
        </GoogleMap>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/30 to-transparent p-3">
          <div className="rounded-lg bg-white/95 px-2.5 py-1 shadow-md backdrop-blur-sm">
            <p className="text-[8px] font-black uppercase leading-none text-slate-500">From</p>
            <p className="text-[10px] font-black uppercase leading-none text-teal-700">You</p>
          </div>
          <div
            className={cn(
              "max-w-[55%] rounded-lg border-b-2 bg-white/95 px-2.5 py-1 shadow-md backdrop-blur-sm",
              isHub ? "border-emerald-500" : "border-teal-500",
            )}
          >
            <p className="text-[8px] font-black uppercase leading-none text-slate-500">Next</p>
            <p
              className={cn(
                "truncate text-[10px] font-black uppercase leading-none",
                isHub ? "text-emerald-600" : "text-teal-700",
              )}
            >
              {targetLabel}
            </p>
          </div>
        </div>

        <div className="absolute bottom-2 left-2 right-2 z-10 flex items-end justify-between gap-2">
          <div className="rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-600 shadow-sm backdrop-blur">
            {routeLoading
              ? "Updating route…"
              : phaseLabel || (isHub ? "Hub delivery" : "Seller pickup")}
          </div>
          <div className="flex gap-2">
            {rider && (
              <button
                type="button"
                onClick={recenter}
                aria-label="Recenter on my location"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-teal-700 shadow-md"
              >
                <Crosshair size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => openExternalMaps(rider, dest)}
              aria-label="Open navigation in Google Maps"
              className="flex h-10 min-w-[10rem] items-center justify-center gap-2 rounded-xl bg-teal-600 px-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-teal-600/30"
            >
              <Navigation size={16} />
              Navigate
            </button>
          </div>
        </div>
      </div>

      {/* ETA card — same pattern as Delivery Order Details */}
      <div
        className={cn(
          "flex items-center justify-between gap-4 rounded-2xl border p-4 shadow-sm",
          isHub
            ? "border-emerald-100 bg-emerald-50/80"
            : "border-teal-100 bg-teal-50/60",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              isHub ? "bg-emerald-100 text-emerald-700" : "bg-teal-100 text-teal-700",
            )}
          >
            <Navigation size={20} aria-hidden />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "text-[11px] font-bold uppercase tracking-wider",
                isHub ? "text-emerald-700" : "text-teal-700",
              )}
            >
              Estimated time
            </p>
            <p className="truncate text-xl font-black leading-none text-slate-900">
              {arrivalClock}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Arriving in
          </p>
          <p className="text-xl font-black leading-none text-slate-900">{arrivingIn}</p>
          {distanceLabel && (
            <p className="mt-1 text-[10px] font-semibold text-slate-500">{distanceLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
};

function propsEqual(prev, next) {
  return (
    prev.partnerLoc?.lat === next.partnerLoc?.lat &&
    prev.partnerLoc?.lng === next.partnerLoc?.lng &&
    prev.targetLoc?.lat === next.targetLoc?.lat &&
    prev.targetLoc?.lng === next.targetLoc?.lng &&
    prev.targetLabel === next.targetLabel &&
    prev.phaseLabel === next.phaseLabel &&
    prev.distance === next.distance &&
    prev.eta === next.eta &&
    prev.stops === next.stops
  );
}

export default memo(InAppNavMap, propsEqual);
