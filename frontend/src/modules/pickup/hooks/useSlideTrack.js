import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Measures slide track width and computes dynamic max travel for SlideToAction.
 */
export function useSlideTrack(thumbSize = 44, padding = 6) {
  const trackRef = useRef(null);
  const [maxTravel, setMaxTravel] = useState(0);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    setMaxTravel(Math.max(0, width - thumbSize - padding * 2));
  }, [thumbSize, padding]);

  useEffect(() => {
    measure();
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { trackRef, maxTravel, measure };
}
