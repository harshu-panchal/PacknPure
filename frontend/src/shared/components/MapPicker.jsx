import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Circle,
  Autocomplete,
} from "@react-google-maps/api";
import { Search, MapPin, Navigation, Loader2, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";

const libraries = ["places", "geometry"];
const mapContainerStyle = {
  width: "100%",
  height: "400px",
};

const defaultCenter = {
  lat: 20.5937,
  lng: 78.9629,
};

async function reverseGeocodeClient(marker) {
  const geocoder = new window.google.maps.Geocoder();
  const result = await new Promise((resolve, reject) => {
    geocoder.geocode({ location: marker }, (results, status) => {
      if (status === "OK" && results?.[0]) resolve(results[0]);
      else reject(new Error(status || "Geocode failed"));
    });
  });
  return result.formatted_address || "";
}

/**
 * @param {object} props
 * @param {object} [props.geocodeApi] — optional server geocoding
 * @param {(lat: number, lng: number) => Promise<{address?: string}>} [props.geocodeApi.reverseGeocode]
 * @param {(address: string) => Promise<{address?: string, lat?: number, lng?: number}>} [props.geocodeApi.geocodeAddress]
 */
const MapPicker = ({
  isOpen,
  onClose,
  onConfirm,
  initialLocation = null,
  initialAddress = "",
  initialRadius = 5,
  maxRadius = 20,
  showRadius = true,
  title = "Select Location",
  geocodeApi = null,
}) => {
  const [center, setCenter] = useState(initialLocation || defaultCenter);
  const [marker, setMarker] = useState(initialLocation);
  const [radius, setRadius] = useState(initialRadius);
  const [address, setAddress] = useState(initialAddress || "");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const autocompleteRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  useEffect(() => {
    if (initialLocation) {
      setCenter(initialLocation);
      setMarker(initialLocation);
    }
  }, [initialLocation]);

  useEffect(() => {
    if (isOpen) {
      setAddress(initialAddress || "");
      setRadius(initialRadius);
    }
  }, [isOpen, initialAddress, initialRadius]);

  const resolveAddressForMarker = useCallback(
    async (pos) => {
      if (geocodeApi?.reverseGeocode) {
        try {
          const res = await geocodeApi.reverseGeocode(pos.lat, pos.lng);
          const payload = res?.data?.result || res?.data || res;
          if (payload?.address) return payload.address;
        } catch (apiErr) {
          const status = apiErr.response?.status;
          if (status !== 503 && status !== 500) {
            throw apiErr;
          }
          // Server key missing — fall back to browser Geocoder if maps script is loaded
        }
      }
      if (isLoaded && window.google?.maps) {
        return reverseGeocodeClient(pos);
      }
      return "";
    },
    [geocodeApi, isLoaded],
  );

  const applyMarkerAndAddress = useCallback(
    async (pos, { silent = false } = {}) => {
      setMarker(pos);
      setCenter(pos);
      setIsGeocoding(true);
      try {
        const resolved = await resolveAddressForMarker(pos);
        if (resolved) setAddress(resolved);
        else if (!silent) toast.message("Location set. You can type the address manually.");
      } catch (err) {
        if (!silent) {
          toast.error(
            err.response?.data?.message ||
            err.message ||
            "Could not fetch address for this point",
          );
        }
      } finally {
        setIsGeocoding(false);
      }
    },
    [resolveAddressForMarker],
  );

  const onMapClick = useCallback(
    (e) => {
      const newPos = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      };
      applyMarkerAndAddress(newPos);
    },
    [applyMarkerAndAddress],
  );

  const onMarkerDragEnd = useCallback(
    (e) => {
      const newPos = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      };
      applyMarkerAndAddress(newPos, { silent: true });
    },
    [applyMarkerAndAddress],
  );

  const handlePlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry) {
        const newPos = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        setCenter(newPos);
        setMarker(newPos);
        setAddress(place.formatted_address || "");
      }
    }
  };

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported on this device");
      return;
    }

    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        try {
          await applyMarkerAndAddress(newPos);
          toast.success("Current location loaded");
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (err) => {
        setIsFetchingLocation(false);
        const msg =
          err.code === 1
            ? "Location permission denied. Allow location access or pick on the map."
            : "Unable to get your current location";
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const locateManualAddress = async () => {
    const query = String(address || "").trim();
    if (query.length < 5) {
      toast.error("Enter a complete store address first");
      return;
    }

    setIsGeocoding(true);
    try {
      if (geocodeApi?.geocodeAddress) {
        try {
          const res = await geocodeApi.geocodeAddress(query);
          const payload = res?.data?.result || res?.data || res;
          if (payload?.lat != null && payload?.lng != null) {
            const newPos = { lat: Number(payload.lat), lng: Number(payload.lng) };
            setMarker(newPos);
            setCenter(newPos);
            setAddress(payload.address || query);
            toast.success("Address located on map");
            return;
          }
        } catch (apiErr) {
          const status = apiErr.response?.status;
          if (status !== 503 && status !== 500 && isLoaded && window.google?.maps) {
            // try client below
          } else if (status !== 503 && status !== 500) {
            throw apiErr;
          }
        }
      }

      if (isLoaded && window.google?.maps) {
        const geocoder = new window.google.maps.Geocoder();
        const result = await new Promise((resolve, reject) => {
          geocoder.geocode(
            { address: query, componentRestrictions: { country: "IN" } },
            (results, status) => {
              if (status === "OK" && results?.[0]) resolve(results[0]);
              else reject(new Error("Address not found"));
            },
          );
        });
        const newPos = {
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
        };
        setMarker(newPos);
        setCenter(newPos);
        setAddress(result.formatted_address || query);
        toast.success("Address located on map");
        return;
      }

      toast.error("Map geocoding is not available");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        error.message ||
        "Could not find this address",
      );
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleConfirm = async () => {
    if (!marker) {
      toast.error("Select a location on the map or use current location");
      return;
    }

    const manualAddress = String(address || "").trim();
    if (!manualAddress) {
      toast.error("Enter your store address or fetch it from the map pin");
      return;
    }

    onConfirm({
      ...marker,
      radius,
      address: manualAddress,
    });
    onClose();
  };

  if (loadError) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title}>
        <div className="p-8 text-center text-red-500">
          Failed to load Google Maps. Please check your API key and connection.
        </div>
      </Modal>
    );
  }

  const busy = isGeocoding || isFetchingLocation;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {marker
              ? `${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)}`
              : "No pin selected"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!marker || busy}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm location
            </Button>
          </div>
        </div>
      }>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-2 font-semibold"
            onClick={fetchCurrentLocation}
            disabled={busy}>
            {isFetchingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            Fetch current location
          </Button>
          <p className="text-xs leading-relaxed text-slate-500 sm:flex sm:items-center">
            Uses GPS to place the pin and fill the address. You can edit the
            address below.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            {isLoaded && (
              <Autocomplete
                onLoad={(ref) => {
                  autocompleteRef.current = ref;
                }}
                onPlaceChanged={handlePlaceChanged}
                options={{
                  componentRestrictions: { country: "IN" },
                  fields: ["geometry", "formatted_address"],
                }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search area or landmark..."
                    className="pl-10"
                  />
                </div>
              </Autocomplete>
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Store address
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            placeholder="Building, street, area, city, state, PIN — or use Fetch current location"
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs font-semibold"
              onClick={locateManualAddress}
              disabled={busy}>
              {isGeocoding ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Navigation className="mr-1 h-3.5 w-3.5" />
              )}
              Locate address on map
            </Button>
            <span className="text-[11px] text-slate-500 self-center">
              Edit text manually or move the pin on the map
            </span>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-xl border border-gray-200 shadow-inner"
          data-lenis-prevent
          data-lenis-prevent-touch="true"
        >
          {!isLoaded ? (
            <div className="flex h-[400px] items-center justify-center bg-gray-50">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={marker ? 16 : 5}
              onClick={onMapClick}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}>
              {marker && (
                <>
                  <Marker
                    position={marker}
                    draggable
                    onDragEnd={onMarkerDragEnd}
                    animation={window.google.maps.Animation.DROP}
                  />
                  {showRadius && (
                    <Circle
                      center={marker}
                      radius={radius * 1000}
                      options={{
                        fillColor: "#0ea5e9",
                        fillOpacity: 0.1,
                        strokeColor: "#0ea5e9",
                        strokeOpacity: 0.5,
                        strokeWeight: 2,
                        clickable: false,
                        editable: false,
                        zIndex: 1,
                      }}
                    />
                  )}
                </>
              )}
            </GoogleMap>
          )}
        </div>

        {showRadius && (
          <div className="space-y-3 rounded-lg bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Service radius (km)
              </label>
              <span className="text-sm font-bold text-primary">{radius} km</span>
            </div>
            <input
              type="range"
              min="1"
              max={maxRadius}
              step="1"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="accent-primary h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>1 km</span>
              <span>{maxRadius} km</span>
            </div>
            <p className="flex items-start gap-1 text-xs text-gray-500">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              Customers within this radius from your shop can see and order from
              you.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default MapPicker;
