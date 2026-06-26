import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/** Default delays (ms) — search/API: debounce; scroll/resize: throttle */
export const DEBOUNCE_MS = {
  /** Typing in search bars before API or heavy filter (recommended for search) */
  search: 400,
  /** List filters, admin tables */
  filter: 350,
  /** Places autocomplete, secondary lookups */
  places: 450,
};

export const THROTTLE_MS = {
  /** Scroll, resize, map pan */
  default: 200,
};

/**
 * Debounce a value — updates `debouncedValue` after `delay` ms of no changes.
 * Use for: search input → API calls, expensive filters.
 */
export function useDebouncedValue(value, delay = DEBOUNCE_MS.search) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const delayMs = Math.max(0, Number(delay) || 0);

  useEffect(() => {
    if (delayMs === 0) {
      setDebouncedValue(value);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Throttle a value — at most one update per `interval` ms while `value` changes.
 * Use for: scroll position, window resize (not search typing).
 */
export function useThrottledValue(value, interval = THROTTLE_MS.default) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRanRef = useRef(0);
  const intervalMs = Math.max(0, Number(interval) || 0);

  useEffect(() => {
    if (intervalMs === 0) {
      setThrottledValue(value);
      return undefined;
    }

    const now = Date.now();
    const elapsed = now - lastRanRef.current;

    if (elapsed >= intervalMs) {
      lastRanRef.current = now;
      setThrottledValue(value);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      lastRanRef.current = Date.now();
      setThrottledValue(value);
    }, intervalMs - elapsed);

    return () => window.clearTimeout(timer);
  }, [value, intervalMs]);

  return throttledValue;
}

/**
 * Returns a stable debounced function (trailing edge).
 * Use when you need to debounce a callback instead of a value.
 */
export function useDebouncedCallback(callback, delay = DEBOUNCE_MS.search) {
  const callbackRef = useRef(callback);
  const timerRef = useRef(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const delayMs = Math.max(0, Number(delay) || 0);

  const debouncedFn = useMemo(() => {
    return (...args) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (delayMs === 0) {
        callbackRef.current(...args);
        return;
      }
      timerRef.current = window.setTimeout(() => {
        callbackRef.current(...args);
      }, delayMs);
    };
  }, [delayMs]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return debouncedFn;
}

/**
 * Search bar helper: immediate `searchTerm` for the input, `debouncedSearchTerm` for API/filter.
 *
 * @example
 * const { searchTerm, setSearchTerm, debouncedSearchTerm } = useDebouncedSearch('', DEBOUNCE_MS.search);
 * useEffect(() => { fetch(debouncedSearchTerm); }, [debouncedSearchTerm]);
 */
export function useDebouncedSearch(initialValue = '', delay = DEBOUNCE_MS.search) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const debouncedSearchTerm = useDebouncedValue(searchTerm, delay);

  return useMemo(
    () => ({
      searchTerm,
      setSearchTerm,
      debouncedSearchTerm,
      /** Trimmed debounced term — handy for API query params */
      debouncedQuery: String(debouncedSearchTerm ?? '').trim(),
    }),
    [searchTerm, debouncedSearchTerm],
  );
}
