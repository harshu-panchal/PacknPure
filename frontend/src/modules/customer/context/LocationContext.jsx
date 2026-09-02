import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { customerApi } from "../services/customerApi";

const LocationContext = createContext(undefined);
// v3 key to force one-time refresh from Google Maps for users
// who previously only had the default/static location cached.
const STORAGE_KEY = "location_v3";

export const LocationProvider = ({ children }) => {
  // Placeholder only — shown until we resolve the visitor's real location.
  const [currentLocation, setCurrentLocation] = useState({
    name: "Please select your location",
    time: "12-15 mins",
    city: "",
    state: "",
    pincode: "",
    latitude: null,
    longitude: null,
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
    return new Promise((resolve, reject) => {
      if (
        typeof window === "undefined" ||
        !("navigator" in window) ||
        !navigator.geolocation
      ) {
        reject(new Error("Geolocation not supported by browser"));
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

            const locObj = {
              name: friendlyName,
              time: "12-15 mins",
              city: locality || sublocality || "",
              state: state || "",
              pincode: pincode || "",
              latitude: latitude,
              longitude: longitude,
            };

            updateLocation(locObj, { persist: true, updateSavedHome: false });
            setIsFetchingLocation(false);
            resolve(locObj);
          } catch (err) {
            setLocationError(err.message || "Unable to fetch address");
            setIsFetchingLocation(false);
            reject(err);
          }
        },
        (error) => {
          const errObj = new Error(error.message || "Location permission denied");
          setLocationError(errObj.message);
          setIsFetchingLocation(false);
          reject(errObj);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        },
      );
    });
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

  // On mount: restore from cache if we have one. Otherwise, silently try a real
  // detection ONLY if the browser already has geolocation permission granted —
  // getCurrentPosition doesn't show a prompt in that case, so no user gesture is
  // needed. If permission isn't granted yet, leave the neutral placeholder in
  // place (and do NOT cache it) rather than presenting a specific wrong city as
  // if it had been detected; the user's tap on the location pill/"use current
  // location" is what triggers the real permission prompt for that case.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    let hadCache = false;
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
          hadCache = true;
        }
      }
    } catch {
      // ignore parse errors
    }

    if (!hadCache && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          if (!cancelled && status.state === "granted") {
            fetchAndCacheLocation().catch(() => {
              // Silent auto-detect failed — keep the neutral placeholder.
            });
          }
        })
        .catch(() => {
          // Permissions API doesn't support the 'geolocation' descriptor here — no-op.
        });
    }

    return () => {
      cancelled = true;
    };
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
