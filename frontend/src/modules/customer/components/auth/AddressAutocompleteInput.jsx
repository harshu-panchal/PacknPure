import React, { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { loadGoogleMaps } from '@core/services/googleMapsLoader';

const getAddressComponent = (components, types) =>
    components?.find((c) => types.every((t) => c.types.includes(t)))?.long_name;

/**
 * Address text input with Google Places Autocomplete.
 * Visual styling is fully controlled by the parent (same classes/layout as before).
 * Falls back to plain manual entry if Maps/Places fails to load.
 */
const AddressAutocompleteInput = ({
    value,
    onChange,
    onPlaceSelect,
    placeholder,
    disabled = false,
    className = '',
    maxLength = 200,
    autoComplete = 'street-address',
    enabled = false,
    id,
    name,
}) => {
    const inputRef = useRef(null);
    const autocompleteRef = useRef(null);
    const listenerRef = useRef(null);
    const selectedAddressRef = useRef('');
    const fallbackNotifiedRef = useRef(false);
    const onPlaceSelectRef = useRef(onPlaceSelect);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onPlaceSelectRef.current = onPlaceSelect;
    }, [onPlaceSelect]);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const notifyFallback = useCallback((message) => {
        if (fallbackNotifiedRef.current) return;
        fallbackNotifiedRef.current = true;
        toast.message(message || 'Address search unavailable. You can enter your address manually.');
    }, []);

    const extractPlace = useCallback((place) => {
        if (!place?.geometry?.location) return null;

        const components = place.address_components || [];
        return {
            address: place.formatted_address || place.name || '',
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            placeId: place.place_id || null,
            city:
                getAddressComponent(components, ['locality']) ||
                getAddressComponent(components, ['administrative_area_level_2']) ||
                null,
            state: getAddressComponent(components, ['administrative_area_level_1']) || null,
            country: getAddressComponent(components, ['country']) || null,
            postalCode: getAddressComponent(components, ['postal_code']) || null,
        };
    }, []);

    const detachAutocomplete = useCallback(() => {
        if (listenerRef.current && window.google?.maps?.event) {
            window.google.maps.event.removeListener(listenerRef.current);
        }
        listenerRef.current = null;
        autocompleteRef.current = null;
    }, []);

    useEffect(() => {
        if (!enabled) {
            detachAutocomplete();
            return undefined;
        }

        let cancelled = false;

        const attach = async () => {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                notifyFallback('Address search unavailable. You can enter your address manually.');
                return;
            }

            try {
                await loadGoogleMaps(apiKey);
                if (cancelled || !inputRef.current) return;

                if (!window.google?.maps?.places?.Autocomplete) {
                    notifyFallback('Address suggestions unavailable. You can type your address manually.');
                    return;
                }

                detachAutocomplete();

                const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
                    fields: ['formatted_address', 'geometry', 'place_id', 'address_components', 'name'],
                    componentRestrictions: { country: 'in' },
                    types: ['geocode'],
                });

                listenerRef.current = autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    const extracted = extractPlace(place);
                    if (!extracted) {
                        toast.message('Could not read that place. Please try another suggestion or type manually.');
                        return;
                    }

                    selectedAddressRef.current = extracted.address;
                    onPlaceSelectRef.current?.(extracted);

                    // Sync controlled input value with formatted address.
                    const syntheticEvent = {
                        target: { value: extracted.address },
                    };
                    onChangeRef.current?.(syntheticEvent);
                });

                autocompleteRef.current = autocomplete;
            } catch {
                if (!cancelled) {
                    notifyFallback('Address search unavailable. You can enter your address manually.');
                }
            }
        };

        attach();

        return () => {
            cancelled = true;
            detachAutocomplete();
        };
    }, [enabled, detachAutocomplete, extractPlace, notifyFallback]);

    const handleChange = (e) => {
        const nextValue = e.target.value;
        // Manual edits invalidate previously selected coordinates.
        if (
            selectedAddressRef.current &&
            nextValue.trim() !== selectedAddressRef.current.trim()
        ) {
            selectedAddressRef.current = '';
            onPlaceSelectRef.current?.(null);
        }
        onChange?.(e);
    };

    return (
        <input
            ref={inputRef}
            id={id}
            name={name}
            type="text"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            maxLength={maxLength}
            autoComplete={autoComplete}
            disabled={disabled}
            className={className}
        />
    );
};

export default AddressAutocompleteInput;
