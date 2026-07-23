import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Loader2 } from "lucide-react";
import { useSlideTrack } from "../hooks/useSlideTrack";
import { cn } from "../utils/cn";

const THUMB = 44;
const PAD = 6;

/**
 * Responsive slide-to-confirm control for Pickup Partner flow.
 * Confirm fires immediately on threshold; loading prop reflects API pending state.
 */
const SlideToAction = ({
  label = "Slide to confirm",
  disabled = false,
  loading = false,
  onConfirm,
  colorClass = "bg-teal-600",
}) => {
  const { trackRef, maxTravel } = useSlideTrack(THUMB, PAD);
  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const confirmingRef = useRef(false);

  const clamp = (value) => Math.max(0, Math.min(maxTravel, value));

  const setOffsetSafe = (value) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const finish = (finalOffset) => {
    const threshold = maxTravel * 0.85;
    if (maxTravel > 0 && finalOffset >= threshold) {
      if (confirmingRef.current || disabled || loading) {
        setOffsetSafe(0);
        return;
      }
      confirmingRef.current = true;
      setOffsetSafe(maxTravel);
      // Reset thumb immediately — do not await the action (loading prop covers pending).
      requestAnimationFrame(() => setOffsetSafe(0));
      try {
        const result = onConfirm?.();
        if (result != null && typeof result.then === "function") {
          result.finally(() => {
            confirmingRef.current = false;
          });
        } else {
          confirmingRef.current = false;
        }
      } catch {
        confirmingRef.current = false;
      }
      return;
    }
    setOffsetSafe(0);
  };

  const onPointerDown = (e) => {
    if (disabled || loading || maxTravel <= 0) return;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || disabled || loading) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    setOffsetSafe(clamp(e.clientX - rect.left - THUMB / 2 - PAD));
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    finish(offsetRef.current);
  };

  const onKeyDown = (e) => {
    if (disabled || loading) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      finish(maxTravel);
    }
  };

  const progress = maxTravel > 0 ? offset / maxTravel : 0;

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative h-[3.5rem] w-full min-w-0 select-none overflow-hidden rounded-2xl shadow-inner",
        "ring-1 ring-white/10",
        colorClass,
        (disabled || loading) && "opacity-50",
      )}
      role="group"
      aria-label={label}
    >
      <div className="pickup-slide-track pointer-events-none absolute inset-0 opacity-60" />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-white/10 transition-[width] duration-75"
        style={{ width: `${Math.min(100, progress * 100)}%` }}
      />
      <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-14 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white/90 sm:text-[11px] sm:tracking-[0.2em]">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Processing…
          </span>
        ) : (
          label
        )}
      </p>
      <motion.button
        type="button"
        className={cn(
          "absolute top-1.5 left-1.5 z-10 flex h-11 w-11 touch-none items-center justify-center rounded-xl",
          "bg-white text-slate-900 shadow-[0_4px_14px_rgba(0,0,0,0.18)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white",
          dragging && "scale-105 shadow-[0_6px_18px_rgba(0,0,0,0.22)]",
        )}
        style={{ x: offset }}
        transition={
          dragging
            ? { type: "tween", duration: 0 }
            : { type: "tween", duration: 0.12 }
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        disabled={disabled || loading}
        aria-label={label}
      >
        <ChevronRight
          size={20}
          className={cn(
            "transition-transform duration-150",
            progress > 0.85 && "text-teal-600 translate-x-0.5",
          )}
        />
      </motion.button>
    </div>
  );
};

export default SlideToAction;
