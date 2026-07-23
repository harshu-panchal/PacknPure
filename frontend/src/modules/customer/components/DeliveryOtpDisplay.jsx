import React, { useEffect, useState, useRef } from "react";
import { CheckCircle, Clock, MapPin, Shield } from "lucide-react";
import {
  getOrderSocket,
  onDeliveryOtpGenerated,
  onDeliveryOtpValidated,
} from "@/core/services/orderSocket";

const normalizeOrderId = (id) =>
  String(id || "")
    .trim()
    .replace(/^ORD/i, "");

const orderIdsMatch = (a, b) => {
  if (!a || !b) return false;
  const sa = String(a).trim();
  const sb = String(b).trim();
  return sa === sb || normalizeOrderId(sa) === normalizeOrderId(sb);
};

/**
 * Displays the delivery OTP on the customer order page when the rider generates it.
 * Hydrates from order details (REST) and updates live via Socket.IO.
 */
const DeliveryOtpDisplay = ({
  orderId,
  initialOtp = null,
  initialExpiresAt = null,
}) => {
  const [otpData, setOtpData] = useState(null);
  const [isDelivered, setIsDelivered] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef(null);

  const calculateRemainingTime = (expiresAt) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = Math.floor((expiry - now) / 1000);
    return Math.max(0, diff);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Hydrate from order details API (refresh / missed socket)
  useEffect(() => {
    if (!initialOtp) return;
    if (initialExpiresAt && new Date(initialExpiresAt).getTime() <= Date.now()) {
      return;
    }
    setOtpData({
      otp: String(initialOtp),
      expiresAt: initialExpiresAt || null,
      deliveryPersonNearby: true,
    });
    if (initialExpiresAt) {
      setRemainingSeconds(calculateRemainingTime(initialExpiresAt));
    }
    setIsDelivered(false);
  }, [initialOtp, initialExpiresAt]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!orderId) return;

    const getToken = () => localStorage.getItem("auth_customer");
    getOrderSocket(getToken);

    const offGenerated = onDeliveryOtpGenerated(getToken, (payload) => {
      if (!orderIdsMatch(payload?.orderId, orderId)) return;
      const otp = payload?.otp ?? payload?.code;
      if (!otp) return;
      setOtpData({
        otp: String(otp),
        expiresAt: payload.expiresAt,
        deliveryPersonNearby: payload.deliveryPersonNearby !== false,
      });
      setIsDelivered(false);
      if (payload.expiresAt) {
        setRemainingSeconds(calculateRemainingTime(payload.expiresAt));
      }
    });

    const offValidated = onDeliveryOtpValidated(getToken, (payload) => {
      if (!orderIdsMatch(payload?.orderId, orderId)) return;
      setIsDelivered(true);
      setOtpData(null);
    });

    return () => {
      offGenerated();
      offValidated();
    };
  }, [orderId]);

  useEffect(() => {
    if (!otpData || remainingSeconds <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setOtpData(null);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [otpData, remainingSeconds]);

  if (isDelivered) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-rose-50 p-6 text-center">
        <div className="mb-3 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
            <CheckCircle className="h-10 w-10 text-rose-600" />
          </div>
        </div>
        <h3 className="mb-1 text-lg font-bold text-brand-900">Delivery Confirmed!</h3>
        <p className="text-sm text-brand-700">Your order has been successfully delivered</p>
      </div>
    );
  }

  if (otpData && isVisible) {
    const isExpiringSoon = remainingSeconds > 0 && remainingSeconds <= 120;

    return (
      <div className="space-y-3">
        {otpData.deliveryPersonNearby && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Delivery Partner Nearby
              </p>
              <p className="text-xs text-blue-700">Share this OTP to complete delivery</p>
            </div>
          </div>
        )}

        <div
          className={`rounded-2xl border p-5 text-center ${
            isExpiringSoon
              ? "border-amber-300 bg-amber-50"
              : "border-[#E23744]/30 bg-gradient-to-br from-rose-50 to-orange-50"
          }`}
        >
          <div className="mb-2 flex items-center justify-center gap-2">
            <Shield
              className={`h-5 w-5 ${isExpiringSoon ? "text-amber-600" : "text-[#E23744]"}`}
            />
            <p
              className={`text-xs font-bold uppercase tracking-wider ${
                isExpiringSoon ? "text-amber-800" : "text-[#E23744]"
              }`}
            >
              Delivery OTP
            </p>
          </div>

          <div
            className={`mb-2 font-mono text-5xl font-black tracking-[0.35em] ${
              isExpiringSoon ? "text-amber-950" : "text-slate-900"
            }`}
            style={{ fontSize: "48px" }}
            aria-label={`Delivery OTP ${otpData.otp}`}
          >
            {otpData.otp}
          </div>

          <p className={`text-xs ${isExpiringSoon ? "text-amber-700" : "text-slate-600"}`}>
            Tell this code to your delivery partner
          </p>
        </div>

        {remainingSeconds > 0 && (
          <div
            className={`flex items-center justify-between rounded-xl border p-3 ${
              isExpiringSoon
                ? "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock
                className={`h-4 w-4 ${isExpiringSoon ? "text-amber-600" : "text-slate-600"}`}
              />
              <span
                className={`text-xs font-semibold ${
                  isExpiringSoon ? "text-amber-900" : "text-slate-700"
                }`}
              >
                {isExpiringSoon ? "Expiring Soon" : "Valid For"}
              </span>
            </div>
            <span
              className={`font-mono text-lg font-bold ${
                isExpiringSoon ? "text-amber-950" : "text-slate-900"
              }`}
            >
              {formatTime(remainingSeconds)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default DeliveryOtpDisplay;
