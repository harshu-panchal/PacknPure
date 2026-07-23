import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deliveryApi } from "../services/deliveryApi";

const THUMB_SIZE = 56; // w-14
const TRACK_PAD = 4; // left-1 / top-1 inset

/**
 * DeliverySlideButton - A slide-to-confirm button for delivery actions
 *
 * Drag distance is measured from the track container (responsive).
 * Success / API logic is unchanged.
 */
const DeliverySlideButton = ({
  orderId,
  onSuccess,
  onError,
  label = "SLIDE TO GENERATE OTP",
  bgColor = "bg-green-600",
  bgColorLight = "bg-green-50",
}) => {
  const trackRef = useRef(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [isSlideComplete, setIsSlideComplete] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const maxDrag = Math.max(0, trackWidth - THUMB_SIZE - TRACK_PAD * 2);
  const completeThreshold = maxDrag * 0.75;

  const measureTrack = useCallback(() => {
    if (trackRef.current) {
      setTrackWidth(trackRef.current.offsetWidth);
    }
  }, []);

  useEffect(() => {
    measureTrack();
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureTrack);
      return () => window.removeEventListener("resize", measureTrack);
    }
    const ro = new ResizeObserver(measureTrack);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureTrack]);

  useEffect(() => {
    setIsSlideComplete(false);
    setDragX(0);
    setIsLoading(false);
  }, [orderId]);

  const resetSlide = () => {
    setIsSlideComplete(false);
    setDragX(0);
    setIsLoading(false);
  };

  const handleSlideComplete = async () => {
    setIsLoading(true);

    try {
      const response = await deliveryApi.generateDeliveryOtp(orderId);

      toast.success(response.data?.message || "OTP generated and sent to customer");

      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message || "Failed to generate OTP";
      const errorCode = error.response?.data?.error?.code;

      if (errorCode === "PROXIMITY_OUT_OF_RANGE") {
        const details = error.response?.data?.error?.details;
        const distance = details?.currentDistance;
        const range = details?.requiredRange || "reach";

        toast.error(
          `You are too ${distance > 120 ? "far" : "close"}. You must be within ${range} of the delivery location.`,
          { duration: 5000 },
        );
      } else if (errorCode === "LOCATION_REQUIRED" || errorCode === "LOCATION_STALE") {
        toast.error(
          errorMessage ||
            "Location data is not available. Please ensure location tracking is enabled.",
        );
      } else if (errorCode === "ORDER_NOT_FOUND") {
        toast.error("Order not found. Please refresh and try again.");
      } else if (errorCode === "UNAUTHORIZED_DELIVERY") {
        toast.error("This order is not assigned to you.");
      } else {
        toast.error(errorMessage);
      }

      if (onError) {
        onError(error);
      }

      resetSlide();
    } finally {
      setIsLoading(false);
    }
  };

  const preferReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(maxDrag) || 100}
      aria-valuenow={Math.round(dragX)}
      aria-disabled={isLoading}
      className="relative h-16 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden select-none touch-pan-y">
      <motion.div
        className={`absolute inset-0 flex items-center justify-center text-gray-400 font-bold text-sm pointer-events-none transition-opacity duration-300 px-16 text-center ${
          dragX > 50 || isLoading ? "opacity-0" : "opacity-100"
        }`}
        animate={preferReducedMotion ? undefined : { x: [0, 5, 0] }}
        transition={
          preferReducedMotion
            ? undefined
            : { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
        }>
        {label} <ChevronRight className="ml-1 inline shrink-0" aria-hidden />
      </motion.div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-gray-100/80 dark:bg-gray-700/80">
          <Loader2 className="animate-spin text-primary" size={24} aria-hidden />
          <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-300">
            Generating OTP...
          </span>
        </div>
      )}

      <motion.div
        className={`absolute inset-y-0 left-0 ${bgColorLight} opacity-50 pointer-events-none`}
        style={{ width: Math.min(dragX + THUMB_SIZE, trackWidth || 0) }}
      />

      <motion.div
        className={`absolute top-1 bottom-1 left-1 w-14 rounded-full flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-20 touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent transition-shadow ${bgColor}`}
        drag={isLoading ? false : "x"}
        dragConstraints={{ left: 0, right: maxDrag }}
        dragElastic={0.05}
        dragMomentum={false}
        onDrag={(_, info) => {
          if (!isLoading) {
            setDragX(Math.max(0, Math.min(info.offset.x, maxDrag)));
          }
        }}
        onDragEnd={(_, info) => {
          if (isLoading) return;

          if (info.offset.x > completeThreshold) {
            setIsSlideComplete(true);
            setDragX(maxDrag);
            handleSlideComplete();
          } else {
            setDragX(0);
          }
        }}
        animate={{ x: isSlideComplete ? maxDrag : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        whileHover={{ scale: isLoading ? 1 : 1.04 }}
        whileTap={{ scale: isLoading ? 1 : 0.96 }}
        tabIndex={isLoading ? -1 : 0}
        onKeyDown={(e) => {
          if (isLoading || isSlideComplete) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsSlideComplete(true);
            setDragX(maxDrag);
            handleSlideComplete();
          }
        }}
        style={{ pointerEvents: isLoading ? "none" : "auto" }}>
        <ChevronRight className="text-white" size={24} aria-hidden />
      </motion.div>
    </div>
  );
};

export default DeliverySlideButton;
