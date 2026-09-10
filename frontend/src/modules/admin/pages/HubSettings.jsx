import React, { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, Marker, useJsApiLoader, Circle, Autocomplete } from "@react-google-maps/api";
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
  Signal as HiOutlineSignal,
  Locate as HiOutlineLocate
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
    deliveryBoyPayoutMode: "distance_matrix",
    deliveryBoyBasePayout: 20,
    deliveryBoyBaseCoverageKm: 1,
    deliveryBoyPerKmPayout: 10,
    deliveryBoyMinPayout: 20,
    platformFee: 3,
    gstPercentage: 5,
    gstRates: [0, 5, 12, 18, 28],
    maxServiceRadius: 15,
    sellerResponseTimeout: 15,
    pickupTimeout: 120,
    hubReceiveTimeout: 180,
    returnConfirmationTimeout: 1440,
    procurementFailureAction: "auto_cancel",
    enableMultiSellerAllocation: false,
    address: "Indore Main Hub, Industrial Area",
    deliveryOtpProximityThreshold: 5000,
  });

  const [matrixTab, setMatrixTab] = useState("customer");
  const [simDistance, setSimDistance] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);

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
          deliveryBoyPayoutMode: data.result.deliveryBoyPayoutMode || "distance_matrix",
          deliveryBoyBasePayout: data.result.deliveryBoyBasePayout ?? 20,
          deliveryBoyBaseCoverageKm: data.result.deliveryBoyBaseCoverageKm ?? 1,
          deliveryBoyPerKmPayout: data.result.deliveryBoyPerKmPayout ?? 10,
          deliveryBoyMinPayout: data.result.deliveryBoyMinPayout ?? 20,
          platformFee: data.result.platformFee ?? 3,
          gstPercentage: data.result.gstPercentage ?? 5,
          gstRates: Array.isArray(data.result.gstRates) ? data.result.gstRates : [0, 5, 12, 18, 28],
          maxServiceRadius: data.result.maxServiceRadius ?? 15,
          sellerResponseTimeout: data.result.sellerResponseTimeout ?? 15,
          pickupTimeout: data.result.pickupTimeout ?? 120,
          hubReceiveTimeout: data.result.hubReceiveTimeout ?? 180,
          returnConfirmationTimeout: data.result.returnConfirmationTimeout ?? 1440,
          procurementFailureAction: data.result.procurementFailureAction || "auto_cancel",
          enableMultiSellerAllocation: data.result.enableMultiSellerAllocation ?? false,
          address: data.result.address || "Indore Main Hub, Industrial Area",
          deliveryOtpProximityThreshold: data.result.deliveryOtpProximityThreshold ?? 5000,
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

  const handlePlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setSettings((prev) => ({
          ...prev,
          hubLocation: {
            ...prev.hubLocation,
            coordinates: [lng, lat],
          },
          address: place.formatted_address || prev.address,
        }));
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
        }
      }
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setSettings((prev) => ({
          ...prev,
          hubLocation: {
            ...prev.hubLocation,
            coordinates: [longitude, latitude],
          },
        }));

        if (mapRef.current) {
          mapRef.current.panTo({ lat: latitude, lng: longitude });
        }

        // Reverse Geocode
        if (window.google?.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
            setIsLocating(false);
            if (status === "OK" && results[0]) {
              setSettings((prev) => ({
                ...prev,
                address: results[0].formatted_address,
              }));
              toast.success("Location and address updated");
            } else {
              toast.success("Current location retrieved (address lookup failed)");
            }
          });
        } else {
          setIsLocating(false);
          toast.success("Current location retrieved");
        }
      },
      (error) => {
        setIsLocating(false);
        console.error("Geolocation error:", error);
        toast.error("Failed to get current location: " + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Public Hub Name / Address
                      </label>
                      <button
                        type="button"
                        onClick={handleGetCurrentLocation}
                        disabled={isLocating}
                        className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase hover:underline disabled:opacity-50 transition-all"
                      >
                        {isLocating ? (
                          <div className="h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        ) : (
                          <HiOutlineLocate className="h-3.5 w-3.5" />
                        )}
                        Use Current Location
                      </button>
                    </div>
                    {isLoaded ? (
                      <Autocomplete
                        onLoad={(ref) => {
                          autocompleteRef.current = ref;
                        }}
                        onPlaceChanged={handlePlaceChanged}
                        options={{
                          componentRestrictions: { country: "IN" },
                          fields: ["geometry", "formatted_address"],
                        }}
                      >
                        <input
                          type="text"
                          value={settings.address}
                          onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          placeholder="Search or enter address manually..."
                        />
                      </Autocomplete>
                    ) : (
                      <input
                        type="text"
                        value={settings.address}
                        onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        placeholder="e.g. Indore Central Logistics Hub"
                      />
                    )}
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
                  
                  <div className="h-px bg-slate-100 my-4" />
                  
                  <div className="space-y-2">
                     <div className="flex items-center justify-between">
                       <span className="text-xs font-bold text-slate-500">Delivery OTP Proximity Limit</span>
                       <span className="text-sm font-black text-primary">{settings.deliveryOtpProximityThreshold ?? 5000} m</span>
                     </div>
                     <input
                      type="number"
                      min="50"
                      max="100000"
                      step="50"
                      value={settings.deliveryOtpProximityThreshold ?? 5000}
                      onChange={(e) => setSettings({ ...settings, deliveryOtpProximityThreshold: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      placeholder="e.g. 5000"
                    />
                    <p className="text-[10px] text-slate-400 font-medium italic">
                      Maximum distance (in meters) the rider can be from the customer's delivery location to generate the OTP.
                    </p>
                  </div>
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

             <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 rounded-2xl bg-white">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <HiOutlineAdjustmentsVertical className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Procurement Matrix</h4>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold text-[9px] px-2 h-5 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ACTIVE
                  </Badge>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enable Multi-Seller Allocation</label>
                    <input
                      type="checkbox"
                      checked={settings.enableMultiSellerAllocation}
                      onChange={(e) => setSettings({ ...settings, enableMultiSellerAllocation: e.target.checked })}
                      className="h-4 w-4 text-primary rounded border-slate-300 focus:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seller Timeout (mins)</label>
                        <input
                          type="number"
                          value={settings.sellerResponseTimeout}
                          onChange={(e) => setSettings({ ...settings, sellerResponseTimeout: Number(e.target.value) })}
                          className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-black text-slate-900 outline-none"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pickup Timeout (mins)</label>
                        <input
                          type="number"
                          value={settings.pickupTimeout}
                          onChange={(e) => setSettings({ ...settings, pickupTimeout: Number(e.target.value) })}
                          className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-black text-slate-900 outline-none"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hub Receive Timeout (mins)</label>
                        <input
                          type="number"
                          value={settings.hubReceiveTimeout}
                          onChange={(e) => setSettings({ ...settings, hubReceiveTimeout: Number(e.target.value) })}
                          className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-black text-slate-900 outline-none"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Return Timeout (mins)</label>
                        <input
                          type="number"
                          value={settings.returnConfirmationTimeout}
                          onChange={(e) => setSettings({ ...settings, returnConfirmationTimeout: Number(e.target.value) })}
                          className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-black text-slate-900 outline-none"
                        />
                     </div>
                  </div>

                  <div className="space-y-2 pt-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Procurement Failure Action</label>
                    <select
                      value={settings.procurementFailureAction}
                      onChange={(e) => setSettings({ ...settings, procurementFailureAction: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-black text-slate-900 outline-none"
                    >
                      <option value="auto_cancel">Auto Cancel Order</option>
                      <option value="put_on_hold">Put On Hold (Manual)</option>
                    </select>
                  </div>
                  
                  <div className="pt-6">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className={cn(
                        "w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                        isSaving && "opacity-70 cursor-not-allowed"
                      )}
                    >
                      {isSaving ? (
                        <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <HiOutlineShieldCheck className="h-4 w-4 text-emerald-400" />
                      )}
                      {isSaving ? "Locking..." : "Lock Matrix Rules"}
                    </button>
                    <p className="text-[10px] text-center text-slate-400 font-medium italic mt-3">
                      This enforces the Procurement rules globally across the system.
                    </p>
                  </div>
                </div>
             </Card>
          </div>
        </div>

        {/* Pricing Side */}
        <div className="space-y-6">
          <Card className="p-8 border-none shadow-2xl ring-1 ring-slate-200 rounded-3xl bg-white h-full">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
                  <HiOutlineAdjustmentsVertical className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Fare & Pricing Matrix
                  </h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Live Unit Economy
                  </p>
                </div>
              </div>
            </div>

            {/* Tab Switcher: Customer vs Delivery Partner */}
            <div className="flex p-1 bg-slate-100 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => setMatrixTab("customer")}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
                  matrixTab === "customer"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                <HiOutlineReceiptTax className="h-4 w-4" />
                Customer Delivery Fee
              </button>
              <button
                type="button"
                onClick={() => setMatrixTab("rider")}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
                  matrixTab === "rider"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                <HiOutlineTruck className="h-4 w-4" />
                Rider Payout (Delivery Boy)
              </button>
            </div>

            {matrixTab === "customer" ? (
              <div className="space-y-6">
                {/* Base Fee */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <HiOutlineCurrencyRupee className="h-4 w-4" />
                      Base Delivery Fee (Customer)
                    </label>
                  </div>
                  <div className="relative group">
                    <input
                      type="number"
                      value={settings.baseDeliveryFee}
                      onChange={(e) => setSettings({ ...settings, baseDeliveryFee: Number(e.target.value) })}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">
                      INR
                    </div>
                  </div>
                </div>

                {/* Base Free KM */}
                <div className="space-y-2">
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
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
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
                <div className="space-y-2">
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
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">
                      / KM
                    </div>
                  </div>
                </div>

                {/* Free Threshold */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <HiOutlineShieldCheck className="h-4 w-4" />
                      Free Delivery Minimum Order
                    </label>
                  </div>
                  <div className="relative group">
                    <input
                      type="number"
                      value={settings.freeDeliveryThreshold}
                      onChange={(e) => setSettings({ ...settings, freeDeliveryThreshold: Number(e.target.value) })}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">
                      INR
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Payout Calculation Mode */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    Rider Payout Calculation Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "distance_matrix", label: "Distance Matrix", desc: "Base + ₹/km" },
                      { key: "pass_through", label: "Pass Customer Fee", desc: "Equal to cust fee" },
                      { key: "fixed", label: "Fixed Flat Rate", desc: "Flat per order" },
                    ].map((mode) => (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => setSettings({ ...settings, deliveryBoyPayoutMode: mode.key })}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all",
                          settings.deliveryBoyPayoutMode === mode.key
                            ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100",
                        )}
                      >
                        <p className="text-xs font-bold leading-tight">{mode.label}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">{mode.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Base Rider Payout */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <HiOutlineCurrencyRupee className="h-4 w-4" />
                      Rider Base Trip Payout
                    </label>
                  </div>
                  <div className="relative group">
                    <input
                      type="number"
                      value={settings.deliveryBoyBasePayout}
                      onChange={(e) => setSettings({ ...settings, deliveryBoyBasePayout: Number(e.target.value) })}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">
                      INR
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium italic">
                    Base earning credited to the rider per delivery trip.
                  </p>
                </div>

                {settings.deliveryBoyPayoutMode === "distance_matrix" && (
                  <>
                    {/* Rider Base Coverage KM */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <HiOutlineMapPin className="h-4 w-4" />
                          Rider Base Coverage (km)
                        </label>
                      </div>
                      <div className="relative group">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={settings.deliveryBoyBaseCoverageKm}
                          onChange={(e) => setSettings({ ...settings, deliveryBoyBaseCoverageKm: Number(e.target.value) })}
                          className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">
                          KM
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium italic">
                        Distance included in base payout. Additional per-km pay starts after this.
                      </p>
                    </div>

                    {/* Rider Distance Rate */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <HiOutlineTruck className="h-4 w-4" />
                          Rider Distance Pay Rate
                        </label>
                      </div>
                      <div className="relative group">
                        <input
                          type="number"
                          value={settings.deliveryBoyPerKmPayout}
                          onChange={(e) => setSettings({ ...settings, deliveryBoyPerKmPayout: Number(e.target.value) })}
                          className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">
                          / KM
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Minimum Guaranteed Payout Floor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <HiOutlineShieldCheck className="h-4 w-4" />
                      Minimum Guaranteed Payout (Floor)
                    </label>
                  </div>
                  <div className="relative group">
                    <input
                      type="number"
                      value={settings.deliveryBoyMinPayout}
                      onChange={(e) => setSettings({ ...settings, deliveryBoyMinPayout: Number(e.target.value) })}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">
                      INR
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium italic">
                    Rider will never earn less than this on any trip (even on free/short deliveries). Set to 0 to disable floor.
                  </p>
                </div>
              </div>
            )}

            {/* Economy Simulation Card */}
            {(() => {
              const custFee = Math.round(
                settings.baseDeliveryFee +
                  Math.max(0, simDistance - settings.baseFreeKm) * settings.perKmDeliveryCharge,
              );
              let riderPay = settings.deliveryBoyBasePayout;
              if (settings.deliveryBoyPayoutMode === "fixed") {
                riderPay = settings.deliveryBoyBasePayout;
              } else if (settings.deliveryBoyPayoutMode === "pass_through") {
                riderPay = custFee;
              } else {
                riderPay = Math.round(
                  settings.deliveryBoyBasePayout +
                    Math.max(0, simDistance - settings.deliveryBoyBaseCoverageKm) *
                      settings.deliveryBoyPerKmPayout,
                );
              }
              if (settings.deliveryBoyMinPayout > 0 && riderPay < settings.deliveryBoyMinPayout) {
                riderPay = settings.deliveryBoyMinPayout;
              }
              const netMargin = custFee + settings.platformFee - riderPay;

              return (
                <div className="mt-8 pt-5 p-5 bg-slate-900 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HiOutlineExclamationCircle className="h-5 w-5 text-amber-400" />
                      <p className="text-[10px] font-black text-white uppercase tracking-widest">
                        Live Economy Simulation
                      </p>
                    </div>
                    {/* Distance Selector */}
                    <div className="flex gap-1">
                      {[2, 5, 8].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSimDistance(d)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all",
                            simDistance === d
                              ? "bg-white text-slate-900"
                              : "bg-white/10 text-white/70 hover:bg-white/20",
                          )}
                        >
                          {d} km
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <div className="flex justify-between items-center text-[11px] font-medium text-white/70">
                      <span>Customer Delivery Fee ({simDistance}km)</span>
                      <span className="font-black text-white">₹{custFee}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-medium text-white/70">
                      <span>Customer Platform Fee</span>
                      <span className="font-black text-white">₹{settings.platformFee}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-medium text-emerald-400">
                      <span>Rider Payout (Delivery Boy)</span>
                      <span className="font-black text-emerald-400">₹{riderPay}</span>
                    </div>
                    <div className="h-px bg-white/10 my-1" />
                    <div className="flex justify-between items-center text-xs font-bold text-white">
                      <span>Platform Net Logistics Balance</span>
                      <span className={cn(netMargin >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {netMargin >= 0 ? `+₹${netMargin}` : `-₹${Math.abs(netMargin)}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HubSettings;
