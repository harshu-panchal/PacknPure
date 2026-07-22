import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import {
  ArrowLeft,
  LocateFixed,
  Phone,
  Navigation as NavIcon,
  Loader2,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import customerPin from "@/assets/customer-pin.png";
import deliveryIcon from "@/assets/deliveryIcon.png";
import { deliveryApi } from "../services/deliveryApi";
import MaskedCallButton from "@/shared/components/delivery/MaskedCallButton";
import { useOrderGpsTracker } from "../hooks/useOrderGpsTracker";
import { getCachedDeliveryPartnerLocation } from "../utils/deliveryLastLocation";

const libraries = ["places", "geometry"];
const mapStyle = { width: "100%", height: "100%" };

function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} min`;
}

export default function InAppNavigation() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const routePolylineRef = useRef(null);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rider, setRider] = useState(() => {
    const c = getCachedDeliveryPartnerLocation();
    return c ? { lat: c.lat, lng: c.lng } : null;
  });
  const [routeData, setRouteData] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries,
  });

  useOrderGpsTracker({ orderId, active: Boolean(orderId), intervalMs: 12000 });

  useEffect(() => {
    if (!orderId) return;
    deliveryApi
      .getOrderDetails(orderId)
      .then((r) => setOrder(r.data?.result))
      .catch(() => {
        toast.error("Failed to load order");
        navigate(-1);
      })
      .finally(() => setLoading(false));
  }, [orderId, navigate]);

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (pos) => setRider({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const destination = useMemo(() => {
    const loc = order?.address?.location;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  }, [order]);

  const fetchRoute = useCallback(async () => {
    if (!orderId || !rider) return;
    try {
      const res = await deliveryApi.getOrderRoute(orderId, {
        phase: "delivery",
        originLat: rider.lat,
        originLng: rider.lng,
      });
      setRouteData(res.data?.result || res.data?.data || null);
    } catch {
      /* degraded */
    }
  }, [orderId, rider]);

  useEffect(() => {
    fetchRoute();
    const iv = setInterval(fetchRoute, 60000);
    return () => clearInterval(iv);
  }, [fetchRoute]);

  const decodedPath = useMemo(() => {
    const encoded = routeData?.polyline;
    if (!encoded || !isLoaded || !window.google?.maps?.geometry?.encoding) return [];
    try {
      return window.google.maps.geometry.encoding.decodePath(encoded);
    } catch {
      return [];
    }
  }, [routeData?.polyline, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) return undefined;
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
    if (!decodedPath.length) return undefined;
    routePolylineRef.current = new window.google.maps.Polyline({
      path: decodedPath,
      strokeColor: "#2563eb",
      strokeOpacity: 0.95,
      strokeWeight: 5,
      map: mapRef.current,
    });
    return () => {
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
      }
    };
  }, [decodedPath, isLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google || !rider) return;
    map.panTo(rider);
  }, [rider?.lat, rider?.lng]);

  const distanceText = formatDistance(
    Number(routeData?.distanceMeters ?? routeData?.distance),
  );
  const etaText = formatEta(Number(routeData?.duration));

  const toggleVoice = () => {
    setVoiceEnabled((v) => !v);
    toast.info(
      voiceEnabled
        ? "Voice guidance off"
        : "Voice guidance ready — connect TTS provider to enable turn-by-turn audio",
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Loader2 className="animate-spin text-white" size={32} />
      </div>
    );
  }

  if (!apiKey || loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-6 text-center">
        <p className="text-sm text-slate-600">Map unavailable. Check Google Maps API key.</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-slate-200">
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={mapStyle}
          center={rider || destination || { lat: 20.59, lng: 78.96 }}
          zoom={16}
          onLoad={(map) => {
            mapRef.current = map;
          }}
          options={{
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          {rider && (
            <Marker
              position={rider}
              icon={
                window.google?.maps
                  ? {
                      url: deliveryIcon,
                      scaledSize: new window.google.maps.Size(44, 64),
                      anchor: new window.google.maps.Point(22, 64),
                    }
                  : undefined
              }
            />
          )}
          {destination && (
            <Marker
              position={destination}
              icon={
                window.google?.maps
                  ? {
                      url: customerPin,
                      scaledSize: new window.google.maps.Size(40, 40),
                      anchor: new window.google.maps.Point(20, 40),
                    }
                  : undefined
              }
            />
          )}
        </GoogleMap>
      ) : (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={28} />
        </div>
      )}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-white shadow-lg backdrop-blur">
          <div className="text-center">
            <p className="text-[10px] font-medium text-white/70">Distance</p>
            <p className="text-sm font-black">{distanceText}</p>
          </div>
          <div className="h-8 w-px bg-white/30" />
          <div className="text-center">
            <p className="text-[10px] font-medium text-white/70">ETA</p>
            <p className="text-sm font-black text-emerald-300">{etaText}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleVoice}
          className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full shadow-lg ${
            voiceEnabled ? "bg-blue-600 text-white" : "bg-white text-slate-700"
          }`}
          aria-label="Toggle voice guidance"
        >
          <Volume2 size={20} />
        </button>
      </div>

      {/* Map controls */}
      <div className="absolute right-3 bottom-44 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => rider && mapRef.current?.panTo(rider)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg"
          aria-label="Recenter"
        >
          <LocateFixed size={20} />
        </button>
        <button
          type="button"
          onClick={fetchRoute}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg"
          aria-label="Refresh route"
        >
          <NavIcon size={20} className="rotate-45" />
        </button>
      </div>

      {/* Bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.15)] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" />
        <div className="flex items-start justify-between gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Deliver to
            </p>
            <h3 className="truncate text-lg font-black text-slate-900">
              {order?.address?.name || "Customer"}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">
              {[order?.address?.address, order?.address?.landmark, order?.address?.city]
                .filter(Boolean)
                .join(", ")}
            </p>
            {order?.notes ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                Note: {order.notes}
              </p>
            ) : null}
          </div>
          <MaskedCallButton
            orderId={orderId}
            role="delivery"
            initiateCall={(id) => deliveryApi.initiateMaskedCall(id)}
            compact
          />
        </div>
        <div className="flex gap-2 px-4">
          <button
            type="button"
            onClick={() => navigate(`/delivery/order-details/${orderId}`)}
            className="min-h-[48px] flex-1 rounded-xl bg-slate-100 text-sm font-bold text-slate-800"
          >
            Order details
          </button>
          <button
            type="button"
            onClick={() => navigate(`/delivery/confirm-delivery/${orderId}`)}
            className="min-h-[48px] flex-1 rounded-xl bg-primary text-sm font-bold text-white shadow-lg"
          >
            Arrived
          </button>
        </div>
      </div>
    </div>
  );
}
