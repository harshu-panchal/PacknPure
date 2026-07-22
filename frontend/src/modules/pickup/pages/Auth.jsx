import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { toast } from "sonner";
import { pickupApi } from "../services/pickupApi";
import { getApiErrorMessage } from "../utils/assignmentUtils";
import {
  ArrowRight,
  Package,
  Smartphone,
  CheckCircle2,
  ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PickupButton,
  PickupInput,
  PickupOtpInput,
} from "../components/ui";

const RESEND_COOLDOWN_SEC = 30;

const Auth = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/pickup/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const handleSendOtp = async () => {
    if (!/^\d{10}$/.test(phone)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    try {
      setLoading(true);
      await pickupApi.sendLoginOtp({ phone });
      toast.success("Verification code sent!");
      setStep("otp");
      setResendIn(RESEND_COOLDOWN_SEC);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to send OTP"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length < 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }
    try {
      setLoading(true);
      const res = await pickupApi.verifyOtp({ phone, otp: otp.trim() });
      const token = res?.data?.result?.token;
      const partner = res?.data?.result?.partner || {};

      if (!token) {
        toast.error("Invalid response from server");
        return;
      }

      login({
        ...partner,
        token,
        role: "pickup_partner",
      });

      toast.success("Welcome, Pickup Partner!");
      navigate("/pickup/dashboard");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Invalid OTP or verification failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden bg-gradient-to-b from-slate-50 to-teal-50/30 px-4 py-8 pickup-safe-top">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-1/4 -top-1/4 h-[50%] w-[50%] rounded-full bg-teal-100/50 blur-[80px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[40%] w-[40%] rounded-full bg-slate-200/40 blur-[60px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="overflow-hidden rounded-3xl border border-white/80 bg-white p-6 shadow-[var(--pickup-shadow-lg)] sm:rounded-[2rem] sm:p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 text-white shadow-lg shadow-teal-600/30 sm:h-20 sm:w-20 sm:rounded-3xl">
              <Package size={32} aria-hidden />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              Pickup Partner
            </h1>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              PacknPure Logistics
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === "phone" ? (
              <motion.div
                key="phone-step"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <PickupInput
                  label="Mobile Number"
                  icon={Smartphone}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="10-digit number"
                  hint="We'll send a one-time verification code"
                />

                <PickupButton
                  fullWidth
                  size="lg"
                  loading={loading}
                  iconRight={ArrowRight}
                  onClick={handleSendOtp}
                >
                  Send Code
                </PickupButton>

                <p className="text-center text-[10px] font-medium leading-relaxed text-slate-400">
                  By continuing, you agree to our Partner Terms
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="otp-step"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                  }}
                  className="flex min-h-[40px] items-center gap-2 text-slate-400 transition-colors hover:text-slate-700"
                >
                  <ChevronLeft size={16} aria-hidden />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Change number
                  </span>
                </button>

                <div className="space-y-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Enter verification code
                  </p>
                  <PickupOtpInput
                    value={otp}
                    onChange={setOtp}
                    length={6}
                    disabled={loading}
                  />
                  <p className="text-[10px] font-semibold text-slate-500">
                    Sent to +91 {phone}
                  </p>
                </div>

                <PickupButton
                  fullWidth
                  size="lg"
                  variant="dark"
                  loading={loading}
                  iconRight={CheckCircle2}
                  onClick={handleVerifyOtp}
                  disabled={otp.length < 6}
                >
                  Verify & Continue
                </PickupButton>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || resendIn > 0}
                    className="min-h-[40px] text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-teal-600 disabled:opacity-50"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
          Verified Logistics
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
