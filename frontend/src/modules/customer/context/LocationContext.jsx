import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { customerApi } from "../services/customerApi";

const LocationContext = createContext(undefined);
// v2 key to force one-time refresh from Google Maps for users
// who previously only had the default/static location cached.
const STORAGE_KEY = "location_v2";

export const LocationProvider = ({ children }) => {
  // Default location (used until we can resolve a better one)
  const [currentLocation, setCurrentLocation] = useState({
    name: "Please select your location",
    time: "12-15 mins",
    city: "Indore",
    state: "Madhya Pradesh",
    pincode: "452018",
    latitude: 22.711140989838025,
    longitude: 75.9001552518043,
  });

  // Address list for drawer UI – will be hydrated from profile API.
  const [savedAddresses, setSavedAddresses] = useState([]);

  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Update the current location.
  // By default this does NOT change saved addresses; only explicit
  // address actions should touch the saved list.
  const updateLocation = (
    newLoc,
    { persist = true, updateSavedHome = false } = {},
  ) => {
    setCurrentLocation(newLoc);

    if (updateSavedHome) {
      setSavedAddresses((prev) =>
        prev.map((addr) =>
          addr.label === "Home" ? { ...addr, address: newLoc.name } : addr,
        ),
      );
    }

    if (persist && typeof window !== "undefined") {
      try {
        const payload = {
          address: newLoc.name,
          city: newLoc.city,
          state: newLoc.state,
          pincode: newLoc.pincode,
          latitude: newLoc.latitude,
          longitude: newLoc.longitude,
          // Internal app properties
          time: newLoc.time,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // ignore storage errors
      }
    }
  };

  const addAddress = (newAddress) => {
    setSavedAddresses((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        label: newAddress.label || "Other",
        address: newAddress.address,
        phone: newAddress.phone || "N/A",
        isCurrent: false,
      },
    ]);
  };

  // Resolve location once using browser geolocation + Google Maps Geocoding.
  // Must be called directly from a user gesture (click/tap) for the browser to show the permission prompt.
  const fetchAndCacheLocation = () => {
    if (
      typeof window === "undefined" ||
      !("navigator" in window) ||
      !navigator.geolocation
    ) {
      return;
    }

    setIsFetchingLocation(true);
    setLocationError(null);

    // Call getCurrentPosition immediately - must run in same synchronous stack as user click
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
          if (!apiKey) {
            throw new Error("Google Maps API key is missing");
          }

          const params = new URLSearchParams({
            latlng: `${latitude},${longitude}`,
            key: apiKey,
          });

          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
          );

          if (!response.ok) {
            throw new Error("Failed to fetch address from Google Maps");
          }

          const data = await response.json();

          // Handle Google Geocoding API error responses
          if (data.status === "REQUEST_DENIED") {
            const msg =
              data.error_message ||
              "Geocoding API rejected (check API key restrictions)";
            throw new Error(msg);
          }
          if (data.status === "OVER_QUERY_LIMIT") {
            throw new Error("Geocoding API quota exceeded");
          }
          if (!data.results || data.results.length === 0) {
            throw new Error(
              data.error_message || "No address found for current location",
            );
          }

          const components = data.results[0].address_components || [];

          const getComponent = (types) =>
            components.find((c) => types.every((t) => c.types.includes(t)))
              ?.long_name;

          // Build address from components to match: "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India"
          const premise = getComponent(["premise"]);
          const neighborhood = getComponent(["neighborhood"]);
          const sublocality = getComponent([
            "sublocality_level_1",
            "sublocality",
          ]);
          const locality = getComponent(["locality"]);
          const state = getComponent(["administrative_area_level_1"]);
          const pincode = getComponent(["postal_code"]);
          const country = getComponent(["country"]);

          const displayParts = [];
          if (premise) displayParts.push(premise);
          if (neighborhood) displayParts.push(neighborhood);
          if (sublocality && sublocality !== neighborhood)
            displayParts.push(sublocality);
          if (locality) displayParts.push(locality);

          let statePincode = "";
          if (state) statePincode += state;
          if (pincode) statePincode += (statePincode ? " " : "") + pincode;
          if (statePincode) displayParts.push(statePincode);

          if (country) displayParts.push(country);

          const friendlyName =
            displayParts.join(", ") ||
            data.results[0]?.formatted_address ||
            `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

          updateLocation(
            {
              name: friendlyName,
              time: "12-15 mins",
              city: locality || "Indore",
              state: state || "Madhya Pradesh",
              pincode: pincode || "452018",
              latitude: latitude,
              longitude: longitude,
            },
            { persist: true, updateSavedHome: false },
          );
          return true;
        } catch (err) {
          setLocationError(err.message || "Unable to fetch address");
          return false;
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (error) => {
        setLocationError(error.message || "Location permission denied");
        setIsFetchingLocation(false);
        return false;
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  };

  const refreshAddresses = useCallback(async () => {
    // Skip if user is not logged in – getProfile would 401 and trigger axios reload loop
    if (!localStorage.getItem("auth_customer")) return;
    try {
      const { data } = await customerApi.getProfile();
      const profile = data?.result ?? data?.data ?? data;
      const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
      setSavedAddresses(
        raw.map((addr, idx) => ({
          id: addr._id ?? String(idx),
          label:
            (addr.label || "Home").charAt(0).toUpperCase() +
            (addr.label || "home").slice(1),
          address:
            addr.fullAddress ||
            [addr.landmark, addr.city, addr.state, addr.pincode]
              .filter(Boolean)
              .join(", ") ||
            "",
          location: addr.location,
          phone: profile?.phone ?? "",
          isCurrent: idx === 0,
        })),
      );
    } catch {
      // If API fails, keep existing in-memory addresses.
    }
  }, []);

  // On mount: hydrate saved addresses from profile (only when customer is logged in)
  useEffect(() => {
    refreshAddresses();
  }, [refreshAddresses]);

  // On mount: only restore from cache. Do NOT auto-fetch – browsers block the
  // location prompt unless it's triggered by a user gesture (e.g. tap).
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const addressName = parsed.address || parsed.name;
        if (parsed && addressName) {
          updateLocation(
            {
              name: addressName,
              time: parsed.time || "12-15 mins",
              city: parsed.city,
              state: parsed.state,
              pincode: parsed.pincode,
              latitude: parsed.latitude,
              longitude: parsed.longitude,
            },
            { persist: false, updateSavedHome: false },
          );
        }
      } else {
        // If no location is stored, persist the default one immediately
        updateLocation(currentLocation, {
          persist: true,
          updateSavedHome: false,
        });
      }
    } catch {
      // ignore parse errors
    }
    // Live fetch happens only when user taps location pill or "Use current location"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        savedAddresses,
        updateLocation,
        addAddress,
        refreshAddresses,
        isFetchingLocation,
        locationError,
        refreshLocation: fetchAndCacheLocation,
      }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};
