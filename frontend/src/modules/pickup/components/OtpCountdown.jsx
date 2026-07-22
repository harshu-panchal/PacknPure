import React, { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "../utils/cn";

const OtpCountdown = ({ expiresAt, onExpired, className }) => {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const expiredFiredRef = useRef(false);
  const onExpiredRef = useRef(onExpired);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    expiredFiredRef.current = false;

    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        onExpiredRef.current?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (secondsLeft == null) return null;

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const urgent = secondsLeft < 60;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-bold shadow-[var(--pickup-shadow-xs)] ring-1",
        urgent
          ? "bg-rose-50 text-rose-700 ring-rose-100"
          : "bg-teal-50/90 text-teal-800 ring-teal-100",
        className,
      )}
    >
      <Clock size={14} aria-hidden className={urgent ? "text-rose-500" : "text-teal-600"} />
      {secondsLeft > 0 ? (
        <span className="tabular-nums tracking-wide">
          OTP expires in {m}:{String(s).padStart(2, "0")}
        </span>
      ) : (
        <span>OTP expired</span>
      )}
    </div>
  );
};

export default OtpCountdown;
