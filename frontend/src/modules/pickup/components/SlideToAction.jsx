import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useSlideTrack } from "../hooks/useSlideTrack";
import { cn } from "../utils/cn";

const THUMB = 44;
const PAD = 6;

/**
 * Responsive slide-to-confirm control for Pickup Partner flow.
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
  const [dragging, setDragging] = useState(false);

  const clamp = (value) => Math.max(0, Math.min(maxTravel, value));

  const finish = async (finalOffset) => {
    const threshold = maxTravel * 0.85;
    if (maxTravel > 0 && finalOffset >= threshold) {
      setOffset(maxTravel);
      try {
        await onConfirm?.();
      } finally {
        setOffset(0);
      }
      return;
    }
    setOffset(0);
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
    setOffset(clamp(e.clientX - rect.left - THUMB / 2 - PAD));
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    finish(offset);
  };

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative h-14 w-full min-w-0 select-none overflow-hidden rounded-2xl",
        colorClass,
        (disabled || loading) && "opacity-50",
      )}
      role="group"
      aria-label={label}
    >
      <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-14 text-center text-[10px] font-black uppercase tracking-[0.15em] text-white/85 sm:text-[11px] sm:tracking-[0.2em]">
        {loading ? "Processing…" : label}
      </p>
      <motion.button
        type="button"
        className="absolute top-1.5 left-1.5 z-10 flex h-11 w-11 touch-none items-center justify-center rounded-xl bg-white text-slate-900 shadow-lg"
        style={{ x: offset }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        disabled={disabled || loading}
        aria-label={label}
      >
        <ChevronRight size={20} />
      </motion.button>
    </div>
  );
};

export default SlideToAction;
