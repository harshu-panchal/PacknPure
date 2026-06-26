import React, { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, Marker, useJsApiLoader, Circle } from "@react-google-maps/api";
import { adminApi } from "../services/adminApi";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin as HiOutlineMapPin,
  CircleDollarSign as HiOutlineCurrencyRupee,
  Truck as HiOutlineTruck,
  CheckCircle as HiOutlineCheckCircle,
  AlertCircle as HiOutlineExclamationCircle,
  Map as HiOutlineMap,
  Settings2 as HiOutlineAdjustmentsVertical,
  RefreshCw as HiOutlineArrowPath,
  Receipt as HiOutlineReceiptTax,
  ShieldCheck as HiOutlineShieldCheck,
  Signal as HiOutlineSignal
} from "lucide-react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import { cn } from "@/lib/utils";

const containerStyle = {
  width: "100%",
  height: "500px",
  borderRadius: "1.5rem",
};

const HubSettings = () => {
  const [settings, setSettings] = useState({
    hubLocation: {
      type: "Point",
      coordinates: [75.8975, 22.7533],
    },
    baseDeliveryFee: 20,
    baseFreeKm: 1,
    perKmDeliveryCharge: 10,
    freeDeliveryThreshold: 500,
    platformFee: 3,
    gstPercentage: 5,
    gstRates: [0, 5, 12, 18, 28],
    maxServiceRadius: 15,
    address: "Indore Main Hub, Industrial Area",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const mapRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ["places", "geometry"],
  });

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const { data } = await adminApi.getSettings();
      if (data.result) {
        setSettings({
          hubLocation: data.result.hubLocation || settings.hubLocation,
          baseDeliveryFee: data.result.baseDeliveryFee ?? 20,
          baseFreeKm: data.result.baseFreeKm ?? 1,
          perKmDeliveryCharge: data.result.perKmDeliveryCharge ?? 10,
          freeDeliveryThreshold: data.result.freeDeliveryThreshold ?? 500,
          platformFee: data.result.platformFee ?? 3,
          gstPercentage: data.result.gstPercentage ?? 5,
          gstRates: Array.isArray(data.result.gstRates) ? data.result.gstRates : [0, 5, 12, 18, 28],
          maxServiceRadius: data.result.maxServiceRadius ?? 15,
          address: data.result.address || "Indore Main Hub, Industrial Area",
        });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast.error("Failed to load hub settings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setSettings((prev) => ({
      ...prev,
      hubLocation: {
        ...prev.hubLocation,
        coordinates: [lng, lat],
      },
    }));
  };

  const handleMarkerDragEnd = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setSettings((prev) => ({
      ...prev,
      hubLocation: {
        ...prev.hubLocation,
        coordinates: [lng, lat],
      },
    }));

    // Reverse Geocode
    if (window.google) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results[0]) {
          setSettings(prev => ({ ...prev, address: results[0].formatted_address }));
        }
      });
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await adminApi.updateSettings(settings);
      toast.success("Hub configuration updated successfully");
    } catch (error) {
      console.error("Failed to update settings:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const currentCoords = {
    lat: settings.hubLocation.coordinates[1],
    lng: settings.hubLocation.coordinates[0],
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
            Syncing Hub Data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Global Hub Control
            </h1>
            <Badge variant="primary" className="bg-primary/10 text-primary border-none font-black px-3">
              CENTRAL OPS
            </Badge>
          </div>
          <p className="text-slate-500 font-medium">
            Manage fulfillment radius, delivery pricing, and global taxation rules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSettings}
            className="p-3 bg-white ring-1 ring-slate-200 rounded-2xl text-slate-400 hover:text-primary transition-all active:scale-95"
          >
            <HiOutlineArrowPath className="h-6 w-6" />
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "px-8 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-2xl shadow-slate-900/20 transition-all active:scale-[0.98] flex items-center gap-3",
              isSaving && "opacity-80 cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <HiOutlineCheckCircle className="h-5 w-5" />
            )}
            {isSaving ? "PUBLISHING..." : "SAVE CONFIGURATION"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Map Side */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-0 border-none shadow-2xl ring-1 ring-slate-200 rounded-3xl overflow-hidden bg-white">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <HiOutlineMap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    Serviceable Zone
                  </h3>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                    {settings.maxServiceRadius}km coverage radius from center
                  </p>
                </div>
              </div>
              <div className="text-right max-w-[200px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Hub Address
                </p>
                <p className="text-xs font-black text-primary truncate" title={settings.address}>
                  {settings.address}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                    Geospatial Verified
                  </p>
                </div>
              </div>
            </div>
            
            <div className="relative">
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={containerStyle}
                  center={currentCoords}
                  zoom={12}
                  onLoad={onMapLoad}
                  onClick={handleMapClick}
                  options={{
                    disableDefaultUI: false,
                    zoomControl: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: true,
                    styles: [
                      {
                        featureType: "poi",
                        elementType: "labels",
                        stylers: [{ visibility: "off" }],
                      },
                    ],
                  }}
                >
                  <Marker
                    position={currentCoords}
                    draggable={true}
                    onDragEnd={handleMarkerDragEnd}
                    animation={window.google?.maps?.Animation?.DROP || 1}
                    icon={{
                      url: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
                      scaledSize: new window.google.maps.Size(40, 40),
                    }}
                  />
                  {/* Service Radius Circle */}
                  <Circle
                    center={currentCoords}
                    radius={settings.maxServiceRadius * 1000}
                    options={{
                      fillColor: "#0ea5e9",
                      fillOpacity: 0.1,
                      strokeColor: "#0ea5e9",
                      strokeOpacity: 0.3,
                      strokeWeight: 2,
                    }}
                  />
                </GoogleMap>
              ) : (
                <div className="h-[500px] bg-slate-100 animate-pulse flex items-center justify-center">
                  <p className="text-slate-400 font-bold">Loading Maps...</p>
                </div>
              )}

              {/* Floating Map Overlay */}
              <div className="absolute top-6 left-6 right-6">
                <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-2xl ring-1 ring-black/5 flex items-center gap-4">
                  <HiOutlineSignal className="h-6 w-6 text-primary shrink-0 animate-pulse" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                      Active Coverage Area
                    </p>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {settings.address}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className="text-[10px] font-black text-emerald-600 uppercase">Status</span>
                     <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold text-[9px] px-1.5 h-5">
                      HEALTHY
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Operational Settings Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 rounded-2xl bg-white">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <HiOutlineMapPin className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Hub Identity</h4>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Public Hub Name / Address</label>
                    <input
                      type="text"
                      value={settings.address}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      placeholder="e.g. Indore Central Logistics Hub"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium italic">
                    This name will be shown to delivery partners as the pickup point.
                  </p>
                </div>
             </Card>

             <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 rounded-2xl bg-white">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <HiOutlineTruck className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Fulfillment Radius</h4>
                </div>
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-bold text-slate-500">Maximum Service Distance</span>
                     <span className="text-sm font-black text-primary">{settings.maxServiceRadius} km</span>
                   </div>
                   <input
                    type="range"
                    min="1"
                    max="50"
                    value={settings.maxServiceRadius}
                    onChange={(e) => setSettings({ ...settings, maxServiceRadius: Number(e.target.value) })}
                    className="w-full accent-primary h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 font-medium italic">
                    Radius beyond which service is unavailable.
                  </p>
                </div>
             </Card>

             <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 rounded-2xl bg-white">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <HiOutlineReceiptTax className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Tax & Platform Fees</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Fee (₹)</label>
                      <input
                        type="number"
                        value={settings.platformFee}
                        onChange={(e) => setSettings({ ...settings, platformFee: Number(e.target.value) })}
                        className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-black text-slate-900 outline-none"
                      />
                   </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available GST Options</label>
                    <button 
                      onClick={() => {
                        const rate = prompt("Enter new GST rate (%)");
                        if (rate !== null && !isNaN(rate)) {
                          const newRate = Number(rate);
                          if (!settings.gstRates.includes(newRate)) {
                            setSettings({ ...settings, gstRates: [...settings.gstRates, newRate].sort((a,b) => a-b) });
                          }
                        }
                      }}
                      className="text-[10px] font-black text-primary uppercase hover:underline"
                    >
                      + Add Rate
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {settings.gstRates.map((rate) => (
                      <div key={rate} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
                        <span className="text-xs font-black text-slate-700">{rate}%</span>
                        <button 
                          onClick={() => setSettings({ ...settings, gstRates: settings.gstRates.filter(r => r !== rate) })}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <HiOutlineExclamationCircle className="h-3 w-3 rotate-45" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium italic">
                    These options will appear in the product management dropdowns for Sellers and Admins.
                  </p>
                </div>
             </Card>
          </div>
        </div>

        {/* Pricing Side */}
        <div className="space-y-6">
          <Card className="p-8 border-none shadow-2xl ring-1 ring-slate-200 rounded-3xl bg-white h-full">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
                <HiOutlineAdjustmentsVertical className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Pricing Matrix
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Live Unit Economy
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {/* Base Fee */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <HiOutlineCurrencyRupee className="h-4 w-4" />
                    Base Delivery Fee
                  </label>
                </div>
                <div className="relative group">
                  <input
                    type="number"
                    value={settings.baseDeliveryFee}
                    onChange={(e) => setSettings({ ...settings, baseDeliveryFee: Number(e.target.value) })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">
                    INR
                  </div>
                </div>
              </div>

              {/* Base Free KM */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <HiOutlineMapPin className="h-4 w-4" />
                    Base Coverage (km)
                  </label>
                </div>
                <div className="relative group">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={settings.baseFreeKm}
                    onChange={(e) => setSettings({ ...settings, baseFreeKm: Number(e.target.value) })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">
                    KM
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium italic">
                  Distance covered under flat base fee. Per-km charges start after this.
                </p>
              </div>

              {/* Per KM Charge */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <HiOutlineTruck className="h-4 w-4" />
                    Distance Rate
                  </label>
                </div>
                <div className="relative group">
                  <input
                    type="number"
                    value={settings.perKmDeliveryCharge}
                    onChange={(e) => setSettings({ ...settings, perKmDeliveryCharge: Number(e.target.value) })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">
                    / KM
                  </div>
                </div>
              </div>

              {/* Free Threshold */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <HiOutlineShieldCheck className="h-4 w-4" />
                    Free Delivery Min
                  </label>
                </div>
                <div className="relative group">
                  <input
                    type="number"
                    value={settings.freeDeliveryThreshold}
                    onChange={(e) => setSettings({ ...settings, freeDeliveryThreshold: Number(e.target.value) })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">
                    MIN
                  </div>
                </div>
              </div>

              <div className="pt-4 p-5 bg-slate-900 rounded-3xl space-y-4">
                <div className="flex items-center gap-3">
                  <HiOutlineExclamationCircle className="h-5 w-5 text-amber-400" />
                  <p className="text-[10px] font-black text-white uppercase tracking-widest">
                    Economy Simulation
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[11px] font-medium text-white/70">
                    <span>5km Delivery Total</span>
                    <span className="font-black text-white">₹{settings.baseDeliveryFee + (5 * settings.perKmDeliveryCharge) + settings.platformFee}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-medium text-white/70">
                    <span>GST Applied</span>
                    <span className="font-black text-emerald-400">{settings.gstPercentage}%</span>
                  </div>
                  <div className="h-px bg-white/10 my-2" />
                  <p className="text-[9px] text-white/40 leading-relaxed font-medium">
                    Pricing is validated server-side based on straight-line Haversine distance from the hub marker shown on map.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HubSettings;
