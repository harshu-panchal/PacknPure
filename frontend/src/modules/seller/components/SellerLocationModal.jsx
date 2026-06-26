import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Search, MapPin, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { loadGoogleMaps } from "../../../core/services/googleMapsLoader";
import { useDebouncedValue, DEBOUNCE_MS } from "@shared/hooks/useDebounce";
import { toast } from 'sonner';

const SellerLocationModal = ({ isOpen, onClose, onSelectLocation }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [placePredictions, setPlacePredictions] = useState([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);

  const MIN_QUERY_LENGTH = 4;
  const MAX_SUGGESTIONS = 5;
  const debouncedSearchQuery = useDebouncedValue(searchQuery, DEBOUNCE_MS?.places || 300);
  const CACHE_TTL_MS = 3 * 60 * 1000;

  const mapsReadyRef = useRef(false);
  const autocompleteServiceRef = useRef(null);
  const geocoderRef = useRef(null);
  const latestPlacesRequestRef = useRef(0);
  const autocompleteSessionTokenRef = useRef(null);
  const placesCacheRef = useRef(new Map());

  const resetAutocompleteSession = useCallback(() => {
    autocompleteSessionTokenRef.current = null;
  }, []);

  const getAutocompleteSessionToken = useCallback(() => {
    if (
      !autocompleteSessionTokenRef.current &&
      window.google?.maps?.places?.AutocompleteSessionToken
    ) {
      autocompleteSessionTokenRef.current =
        new window.google.maps.places.AutocompleteSessionToken();
    }
    return autocompleteSessionTokenRef.current;
  }, []);

  const getComponent = useCallback((components, types) => {
    return components?.find((c) => types.every((t) => c.types.includes(t)))
      ?.long_name;
  }, []);

  const initGooglePlaces = useCallback(async () => {
    if (mapsReadyRef.current) return true;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setPlacesError("Google Maps API key is missing");
      return false;
    }

    try {
      await loadGoogleMaps(apiKey);
      if (!window.google?.maps?.places) {
        setPlacesError("Google Places library is unavailable");
        return false;
      }
      autocompleteServiceRef.current =
        new window.google.maps.places.AutocompleteService();
      geocoderRef.current = new window.google.maps.Geocoder();
      mapsReadyRef.current = true;
      return true;
    } catch (err) {
      setPlacesError(err?.message || "Unable to load Google search");
      return false;
    }
  }, []);

  useEffect(() => {
    if (isOpen) return;
    setSearchQuery("");
    setPlacePredictions([]);
    setIsSearchingPlaces(false);
    setPlacesError("");
    setIsSearchFocused(false);
    resetAutocompleteSession();
  }, [isOpen, resetAutocompleteSession]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleDetectLocation = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDetecting(true);

    if (!("geolocation" in navigator)) {
        setIsDetecting(false);
        toast.error("Geolocation is not supported by your browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            const ready = await initGooglePlaces();
            if (!ready || !geocoderRef.current) {
                // Fallback if maps fail to load but we have coordinates
                onSelectLocation({ address: `${lat}, ${lng}`, lat, lng });
                setIsDetecting(false);
                onClose();
                return;
            }

            geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
                if (status === "OK" && results[0]) {
                    onSelectLocation({
                        address: results[0].formatted_address,
                        lat,
                        lng
                    });
                    toast.success("Location detected successfully!");
                } else {
                    onSelectLocation({ address: `${lat}, ${lng}`, lat, lng });
                    toast.error("Could not determine full address, but coordinates captured.");
                }
                setIsDetecting(false);
                onClose();
            });
        },
        (error) => {
            console.error("Location Error:", error);
            setIsDetecting(false);
            toast.error("Failed to detect location. Please search manually.");
        }
    );
  };

  const handleSelectPlace = useCallback(
    (prediction) => {
      const geocoder = geocoderRef.current;
      if (!geocoder || !prediction?.place_id) return;

      geocoder.geocode({ placeId: prediction.place_id }, (results, status) => {
        if (status !== "OK" || !Array.isArray(results) || !results[0]) {
          setPlacesError("Could not resolve selected location");
          return;
        }

        const result = results[0];
        const geometry = result.geometry?.location;

        if (!geometry) {
          setPlacesError("Location coordinates not available");
          return;
        }

        onSelectLocation({
            address: result.formatted_address || prediction.description,
            lat: geometry.lat(),
            lng: geometry.lng(),
        });

        setSearchQuery("");
        setPlacePredictions([]);
        setPlacesError("");
        setIsSearchFocused(false);
        resetAutocompleteSession();
        onClose();
      });
    },
    [onClose, resetAutocompleteSession, onSelectLocation]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (!isSearchFocused) return;

    const query = debouncedSearchQuery.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      latestPlacesRequestRef.current += 1;
      setPlacePredictions([]);
      setIsSearchingPlaces(false);
      setPlacesError("");
      return;
    }
    
    const cacheKey = query.toLowerCase();
    const cached = placesCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setPlacePredictions(cached.predictions);
      setIsSearchingPlaces(false);
      setPlacesError("");
      return;
    }

    (async () => {
      const ready = await initGooglePlaces();
      if (!ready || !autocompleteServiceRef.current) return;

      const requestId = latestPlacesRequestRef.current + 1;
      latestPlacesRequestRef.current = requestId;
      const querySnapshot = query;

      setIsSearchingPlaces(true);
      setPlacesError("");

      const request = {
        input: query,
        types: ["geocode"],
        componentRestrictions: { country: "in" },
        sessionToken: getAutocompleteSessionToken(),
      };

      autocompleteServiceRef.current.getPlacePredictions(
        request,
        (predictions, status) => {
          if (
            requestId !== latestPlacesRequestRef.current ||
            querySnapshot !== debouncedSearchQuery.trim()
          ) {
            return;
          }

          setIsSearchingPlaces(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            const trimmedPredictions = Array.isArray(predictions)
              ? predictions.slice(0, MAX_SUGGESTIONS)
              : [];
            setPlacePredictions(trimmedPredictions);
            placesCacheRef.current.set(cacheKey, {
              predictions: trimmedPredictions,
              expiresAt: Date.now() + CACHE_TTL_MS,
            });
            return;
          }
          if (
            status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS
          ) {
            setPlacePredictions([]);
            return;
          }
          setPlacePredictions([]);
          setPlacesError("Google search is temporarily unavailable");
        },
      );
    })();

    return undefined;
  }, [
    CACHE_TTL_MS,
    MAX_SUGGESTIONS,
    MIN_QUERY_LENGTH,
    debouncedSearchQuery,
    getAutocompleteSessionToken,
    initGooglePlaces,
    isSearchFocused,
    isOpen,
  ]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[600]"
          />

          <div className="fixed inset-0 z-[610] flex flex-col justify-center items-center px-4 sm:px-0 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-[500px] bg-slate-50 rounded-3xl max-h-[85vh] overflow-y-auto outline-none shadow-2xl pb-6 pointer-events-auto"
            >
            {/* Header */}
            <div className="sticky top-0 bg-slate-50 px-6 pt-6 pb-4 flex flex-col gap-4 z-20">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-slate-800">
                  Find Shop Location
                </h2>
                <button
                  onClick={onClose}
                  className="h-10 w-10 bg-slate-200/50 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors">
                  <X size={20} className="text-slate-600" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Search
                    size={20}
                    className="text-slate-400 group-focus-within:text-indigo-600 transition-colors"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Search for area, street name.."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={async () => {
                    setIsSearchFocused(true);
                    await initGooglePlaces();
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setIsSearchFocused(false), 120);
                  }}
                  className="w-full bg-white border-2 border-transparent rounded-[20px] py-4 pl-12 pr-4 text-sm font-bold placeholder:text-slate-400 shadow-sm focus:border-indigo-100 outline-none transition-all"
                />
              </div>
              <p className="text-[11px] font-semibold text-slate-400 px-1">
                Type at least 4 characters
              </p>
            </div>

            {/* Options List */}
            <div className="px-4 flex flex-col gap-3">
              {searchQuery.trim().length >= MIN_QUERY_LENGTH && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  {isSearchingPlaces && placePredictions.length === 0 && (
                    <div className="px-4 py-3 text-sm font-bold text-slate-500">
                      Searching with Google...
                    </div>
                  )}

                  {placePredictions.map((prediction) => (
                    <button
                      key={prediction.place_id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectPlace(prediction)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b last:border-b-0 border-slate-100 transition-colors">
                      <div className="flex items-start gap-3">
                        <MapPin
                          size={16}
                          className="text-indigo-600 mt-0.5 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-slate-800 truncate">
                            {prediction.structured_formatting?.main_text ||
                              prediction.description}
                          </p>
                          <p className="text-xs text-slate-500 font-semibold truncate">
                            {prediction.structured_formatting?.secondary_text ||
                              prediction.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}

                  {!isSearchingPlaces &&
                    placePredictions.length === 0 &&
                    !placesError && (
                      <div className="px-4 py-3 text-sm font-bold text-slate-500">
                        No locations found
                      </div>
                    )}

                  {placesError && (
                    <div className="px-4 py-3 text-sm font-bold text-rose-500 bg-rose-50">
                      {placesError}
                    </div>
                  )}
                </div>
              )}

              {/* Current Location */}
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetecting}
                className="flex items-center gap-4 bg-white p-4 rounded-2xl hover:bg-indigo-50 transition-colors group text-left shadow-sm w-full border border-transparent hover:border-indigo-100">
                <div className="h-10 w-10 flex items-center justify-center text-indigo-600">
                  <MapPin
                    size={24}
                    className="group-hover:scale-110 transition-transform"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-extrabold text-indigo-600 text-[15px]">
                    {isDetecting
                      ? "Detecting your location..."
                      : "Detect my current location"}
                  </h3>
                  <p className="text-[12px] text-slate-500 font-bold">
                    Uses GPS to find your shop automatically
                  </p>
                </div>
                <ChevronRight size={20} className="text-slate-300" />
              </button>

            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SellerLocationModal;
