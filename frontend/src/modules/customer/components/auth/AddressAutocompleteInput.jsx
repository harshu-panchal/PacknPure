import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { loadGoogleMaps } from '@core/services/googleMapsLoader';
import { useDebouncedValue, DEBOUNCE_MS } from '@shared/hooks/useDebounce';

const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 5;
const CACHE_TTL_MS = 3 * 60 * 1000;

const getAddressComponent = (components, types) =>
    components?.find((c) => types.every((t) => c.types.includes(t)))?.long_name;

/**
 * Address text input with Google Places suggestions.
 * Uses AutocompleteService (not the native pac-container) so it works inside
 * transformed / overflow-hidden modals like Complete Your Profile.
 * Falls back to plain manual entry if Maps/Places fails.
 */
const AddressAutocompleteInput = ({
    value,
    onChange,
    onPlaceSelect,
    placeholder,
    disabled = false,
    className = '',
    maxLength = 200,
    autoComplete = 'off',
    enabled = false,
    id,
    name,
}) => {
    const inputRef = useRef(null);
    const wrapperRef = useRef(null);
    const mapsReadyRef = useRef(false);
    const autocompleteServiceRef = useRef(null);
    const placesServiceRef = useRef(null);
    const sessionTokenRef = useRef(null);
    const placesCacheRef = useRef(new Map());
    const latestRequestRef = useRef(0);
    const selectedAddressRef = useRef('');
    const fallbackNotifiedRef = useRef(false);
    const blurTimerRef = useRef(null);
    const onPlaceSelectRef = useRef(onPlaceSelect);

    const [isFocused, setIsFocused] = useState(false);
    const [predictions, setPredictions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState(null);

    const debouncedValue = useDebouncedValue(value, DEBOUNCE_MS.places);

    useEffect(() => {
        onPlaceSelectRef.current = onPlaceSelect;
    }, [onPlaceSelect]);

    const notifyFallback = useCallback((message) => {
        if (fallbackNotifiedRef.current) return;
        fallbackNotifiedRef.current = true;
        toast.message(
            message || 'Address search unavailable. You can enter your address manually.',
        );
    }, []);

    const resetSession = useCallback(() => {
        sessionTokenRef.current = null;
    }, []);

    const getSessionToken = useCallback(() => {
        if (
            !sessionTokenRef.current &&
            window.google?.maps?.places?.AutocompleteSessionToken
        ) {
            sessionTokenRef.current =
                new window.google.maps.places.AutocompleteSessionToken();
        }
        return sessionTokenRef.current;
    }, []);

    const initGooglePlaces = useCallback(async () => {
        if (mapsReadyRef.current) return true;

        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            notifyFallback('Address search unavailable. You can enter your address manually.');
            return false;
        }

        try {
            await loadGoogleMaps(apiKey);
            if (!window.google?.maps?.places?.AutocompleteService) {
                notifyFallback(
                    'Address suggestions unavailable. You can type your address manually.',
                );
                return false;
            }

            autocompleteServiceRef.current =
                new window.google.maps.places.AutocompleteService();

            // PlacesService needs a DOM node attribution container.
            const attribution = document.createElement('div');
            placesServiceRef.current = new window.google.maps.places.PlacesService(
                attribution,
            );

            mapsReadyRef.current = true;
            return true;
        } catch {
            notifyFallback('Address search unavailable. You can enter your address manually.');
            return false;
        }
    }, [notifyFallback]);

    const updateDropdownPosition = useCallback(() => {
        const el = wrapperRef.current || inputRef.current;
        if (!el) {
            setDropdownStyle(null);
            return;
        }
        const rect = el.getBoundingClientRect();
        setDropdownStyle({
            position: 'fixed',
            top: Math.round(rect.bottom + 6),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            zIndex: 10050,
        });
    }, []);

    // Prefetch Maps when the profile modal opens (lazy — not on every page).
    useEffect(() => {
        if (!enabled) {
            setPredictions([]);
            setIsSearching(false);
            setIsFocused(false);
            resetSession();
            return undefined;
        }
        initGooglePlaces();
        return undefined;
    }, [enabled, initGooglePlaces, resetSession]);

    // Keep dropdown aligned while scrolling the modal / resizing.
    useEffect(() => {
        if (!isFocused || predictions.length === 0) return undefined;

        updateDropdownPosition();
        const onReposition = () => updateDropdownPosition();
        window.addEventListener('resize', onReposition);
        window.addEventListener('scroll', onReposition, true);
        return () => {
            window.removeEventListener('resize', onReposition);
            window.removeEventListener('scroll', onReposition, true);
        };
    }, [isFocused, predictions.length, updateDropdownPosition]);

    // Debounced Places predictions.
    useEffect(() => {
        if (!enabled || !isFocused) return undefined;

        const query = String(debouncedValue || '').trim();

        // Don't search after a place was just selected (value matches selected).
        if (
            selectedAddressRef.current &&
            query === selectedAddressRef.current.trim()
        ) {
            setPredictions([]);
            setIsSearching(false);
            return undefined;
        }

        if (query.length < MIN_QUERY_LENGTH) {
            latestRequestRef.current += 1;
            setPredictions([]);
            setIsSearching(false);
            return undefined;
        }

        const cacheKey = query.toLowerCase();
        const cached = placesCacheRef.current.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            setPredictions(cached.predictions);
            setIsSearching(false);
            updateDropdownPosition();
            return undefined;
        }

        let cancelled = false;

        (async () => {
            const ready = await initGooglePlaces();
            if (cancelled || !ready || !autocompleteServiceRef.current) return;

            const requestId = latestRequestRef.current + 1;
            latestRequestRef.current = requestId;
            const querySnapshot = query;

            setIsSearching(true);

            const request = {
                input: query,
                types: ['geocode'],
                componentRestrictions: { country: 'in' },
                sessionToken: getSessionToken(),
            };

            autocompleteServiceRef.current.getPlacePredictions(
                request,
                (results, status) => {
                    if (
                        cancelled ||
                        requestId !== latestRequestRef.current ||
                        querySnapshot !== String(debouncedValue || '').trim()
                    ) {
                        return;
                    }

                    setIsSearching(false);

                    if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                        const trimmed = Array.isArray(results)
                            ? results.slice(0, MAX_SUGGESTIONS)
                            : [];
                        setPredictions(trimmed);
                        placesCacheRef.current.set(cacheKey, {
                            predictions: trimmed,
                            expiresAt: Date.now() + CACHE_TTL_MS,
                        });
                        updateDropdownPosition();
                        return;
                    }

                    if (
                        status ===
                        window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS
                    ) {
                        setPredictions([]);
                        return;
                    }

                    setPredictions([]);
                    // Don't toast every failed keystroke — allow manual entry quietly.
                },
            );
        })();

        return () => {
            cancelled = true;
        };
    }, [
        debouncedValue,
        enabled,
        getSessionToken,
        initGooglePlaces,
        isFocused,
        updateDropdownPosition,
    ]);

    const extractFromPlaceResult = useCallback((place, fallbackDescription) => {
        if (!place?.geometry?.location) return null;
        const components = place.address_components || [];
        return {
            address: place.formatted_address || fallbackDescription || '',
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            placeId: place.place_id || null,
            city:
                getAddressComponent(components, ['locality']) ||
                getAddressComponent(components, ['administrative_area_level_2']) ||
                null,
            state:
                getAddressComponent(components, ['administrative_area_level_1']) ||
                null,
            country: getAddressComponent(components, ['country']) || null,
            postalCode: getAddressComponent(components, ['postal_code']) || null,
        };
    }, []);

    const handleSelectPrediction = useCallback(
        (prediction) => {
            if (!prediction?.place_id || !placesServiceRef.current) return;

            placesServiceRef.current.getDetails(
                {
                    placeId: prediction.place_id,
                    fields: [
                        'formatted_address',
                        'geometry',
                        'place_id',
                        'address_components',
                        'name',
                    ],
                    sessionToken: getSessionToken(),
                },
                (place, status) => {
                    resetSession();

                    if (
                        status !== window.google.maps.places.PlacesServiceStatus.OK ||
                        !place
                    ) {
                        toast.message(
                            'Could not read that place. Please try another suggestion or type manually.',
                        );
                        return;
                    }

                    const extracted = extractFromPlaceResult(
                        place,
                        prediction.description,
                    );
                    if (!extracted) {
                        toast.message(
                            'Location coordinates not available. You can type the address manually.',
                        );
                        return;
                    }

                    selectedAddressRef.current = extracted.address;
                    setPredictions([]);
                    setIsSearching(false);

                    onPlaceSelectRef.current?.(extracted);
                    onChange?.({ target: { value: extracted.address } });
                },
            );
        },
        [extractFromPlaceResult, getSessionToken, onChange, resetSession],
    );

    const handleChange = (e) => {
        const nextValue = e.target.value;
        if (
            selectedAddressRef.current &&
            nextValue.trim() !== selectedAddressRef.current.trim()
        ) {
            selectedAddressRef.current = '';
            onPlaceSelectRef.current?.(null);
        }
        onChange?.(e);
    };

    const showDropdown =
        isFocused &&
        enabled &&
        !disabled &&
        dropdownStyle &&
        (predictions.length > 0 ||
            (isSearching &&
                String(value || '').trim().length >= MIN_QUERY_LENGTH));

    const dropdown =
        showDropdown &&
        createPortal(
            <div
                style={dropdownStyle}
                className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-56 overflow-y-auto"
                role="listbox"
                onMouseDown={(e) => {
                    // Prevent input blur before click registers.
                    e.preventDefault();
                }}
            >
                {isSearching && predictions.length === 0 && (
                    <div className="px-4 py-3 text-sm font-semibold text-slate-500">
                        Searching addresses…
                    </div>
                )}
                {predictions.map((prediction) => (
                    <button
                        key={prediction.place_id || prediction.description}
                        type="button"
                        role="option"
                        className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                        onClick={() => handleSelectPrediction(prediction)}
                    >
                        <span className="block leading-snug">
                            {prediction.structured_formatting?.main_text ||
                                prediction.description}
                        </span>
                        {prediction.structured_formatting?.secondary_text && (
                            <span className="block text-xs font-medium text-slate-400 mt-0.5">
                                {prediction.structured_formatting.secondary_text}
                            </span>
                        )}
                    </button>
                ))}
            </div>,
            document.body,
        );

    return (
        <span ref={wrapperRef} className="relative flex-1 min-w-0 flex">
            <input
                ref={inputRef}
                id={id}
                name={name}
                type="text"
                value={value}
                onChange={handleChange}
                onFocus={() => {
                    if (blurTimerRef.current) {
                        window.clearTimeout(blurTimerRef.current);
                        blurTimerRef.current = null;
                    }
                    setIsFocused(true);
                    updateDropdownPosition();
                    if (enabled) initGooglePlaces();
                }}
                onBlur={() => {
                    blurTimerRef.current = window.setTimeout(() => {
                        setIsFocused(false);
                        setPredictions([]);
                    }, 150);
                }}
                placeholder={placeholder}
                maxLength={maxLength}
                autoComplete={autoComplete}
                disabled={disabled}
                className={`${className} w-full min-w-0`}
            />
            {dropdown}
        </span>
    );
};

export default AddressAutocompleteInput;
