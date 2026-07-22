import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

/**
 * Slide-to-confirm control used in Pickup Partner flow.
 */
const SlideToAction = ({
  label = "Slide to confirm",
  disabled = false,
  loading = false,
  onConfirm,
  colorClass = "bg-slate-900",
}) => {
  const trackRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const maxTravel = 220;

  const clamp = (value) => Math.max(0, Math.min(maxTravel, value));

  const finish = async (finalOffset) => {
    if (finalOffset >= maxTravel * 0.85) {
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
    if (disabled || loading) return;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || disabled || loading) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    setOffset(clamp(e.clientX - rect.left - 28));
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    finish(offset);
  };

  return (
    <div
      ref={trackRef}
      className={`relative h-14 w-full overflow-hidden rounded-2xl ${colorClass} select-none ${
        disabled || loading ? "opacity-50" : ""
      }`}
    >
      <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-black uppercase tracking-[0.2em] text-white/80">
        {loading ? "Processing..." : label}
      </p>
      <motion.button
        type="button"
        className="absolute top-1.5 left-1.5 z-10 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-900 shadow-lg touch-none"
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
