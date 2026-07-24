import React, { useState, useEffect } from "react";

export const PRCountdown = ({ expiresAt, status, onExpired }) => {
  const getSecondsRemaining = () => {
    if (!expiresAt) return 0;
    const isTerminal = ["seller_rejected", "expired", "cancelled", "closed", "seller_failed"].includes(
      String(status || "").toLowerCase()
    );
    if (isTerminal) return 0;

    const expiryTime = new Date(expiresAt).getTime();
    if (isNaN(expiryTime)) return 0;

    // Use synchronized server time
    const serverTimeMs = Date.now() - (window.__serverTimeOffset || 0);
    return Math.max(0, Math.floor((expiryTime - serverTimeMs) / 1000));
  };

  const [secondsLeft, setSecondsLeft] = useState(getSecondsRemaining);

  useEffect(() => {
    // Initial calculation
    const initialRemaining = getSecondsRemaining();
    setSecondsLeft(initialRemaining);

    const isTerminal = ["seller_rejected", "expired", "cancelled", "closed", "seller_failed"].includes(
      String(status || "").toLowerCase()
    );
    if (isTerminal || !expiresAt || initialRemaining <= 0) {
      if (initialRemaining <= 0 && onExpired) {
        onExpired();
      }
      return;
    }

    const timer = setInterval(() => {
      const remaining = getSecondsRemaining();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        if (onExpired) {
          onExpired();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, status]);

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
    ].join(":");
  };

  const timerColorClass = () => {
    if (secondsLeft <= 0) {
      return "text-slate-500 bg-slate-50 border-slate-100";
    }
    if (secondsLeft > 30 * 60) {
      return "text-emerald-700 bg-emerald-50 border-emerald-100 animate-pulse";
    }
    if (secondsLeft > 10 * 60) {
      return "text-amber-700 bg-amber-50 border-amber-100";
    }
    return "text-rose-700 bg-rose-50 border-rose-100 animate-bounce";
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold font-mono tracking-wider shadow-sm transition-all duration-300 ${timerColorClass()}`}
      title={expiresAt ? `Expires: ${new Date(expiresAt).toLocaleString()}` : ""}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
      {formatTime(secondsLeft)}
    </span>
  );
};

export default PRCountdown;
