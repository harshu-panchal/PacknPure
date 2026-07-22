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
        "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold",
        urgent ? "bg-rose-50 text-rose-700" : "bg-violet-50 text-violet-700",
        className,
      )}
    >
      <Clock size={14} aria-hidden />
      {secondsLeft > 0 ? (
        <span>
          OTP expires in {m}:{String(s).padStart(2, "0")}
        </span>
      ) : (
        <span>OTP expired</span>
      )}
    </div>
  );
};

export default OtpCountdown;
