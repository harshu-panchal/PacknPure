import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { toast } from "sonner";
import { pickupApi } from "../services/pickupApi";
import { 
  Phone, 
  ArrowRight, 
  ShieldCheck, 
  Package, 
  Smartphone,
  CheckCircle2,
  ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Auth = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

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
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      toast.error("Please enter the verification code");
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
      toast.error(error?.response?.data?.message || "Invalid OTP or verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-['Outfit']">
      {/* Decorative Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-100/40 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-200/40 rounded-full blur-[80px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white rounded-[40px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.06)] border border-white p-10 overflow-hidden relative">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center space-y-4 mb-10">
            <div className="h-20 w-20 bg-slate-900 rounded-[30px] flex items-center justify-center text-white shadow-xl rotate-3">
              <Package size={36} />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                PICKUP PORTAL
              </h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Partner Authentication
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === "phone" ? (
              <motion.div
                key="phone-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <Smartphone size={18} />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="Enter 10-digit number"
                      className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-slate-900 transition-all"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="w-full bg-slate-900 text-white rounded-2xl py-4 text-xs font-black uppercase tracking-[2px] shadow-xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? "SENDING CODE..." : "SEND VERIFICATION"}
                  <ArrowRight size={16} />
                </button>

                <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
                  By continuing, you agree to our <br />
                  <span className="text-slate-900">Partner Terms & Conditions</span>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="otp-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <button 
                  onClick={() => setStep("phone")}
                  className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors mb-4"
                >
                  <ChevronLeft size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Back to Phone</span>
                </button>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 text-center block w-full">
                    Enter Verification Code
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000 000"
                      className="w-full bg-slate-50 border-none rounded-2xl px-4 py-4 text-center text-xl font-black text-slate-900 tracking-[0.5em] outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-slate-900 transition-all"
                    />
                  </div>
                  <p className="text-center text-[10px] font-bold text-slate-500 uppercase">
                    Verification code sent to +91 {phone}
                  </p>
                </div>

                <button
                  onClick={handleVerifyOtp}
                  disabled={loading}
                  className="w-full bg-slate-900 text-white rounded-2xl py-4 text-xs font-black uppercase tracking-[2px] shadow-xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? "VERIFYING..." : "ACCESS DASHBOARD"}
                  <CheckCircle2 size={16} />
                </button>

                <div className="text-center">
                  <button className="text-[10px] font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors">
                    Didn't receive code? Resend
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Branding Footer */}
        <div className="mt-8 flex items-center justify-center gap-4 text-slate-300">
          <div className="h-[1px] w-8 bg-slate-200" />
          <span className="text-[10px] font-black uppercase tracking-[4px]">Verified Logistics</span>
          <div className="h-[1px] w-8 bg-slate-200" />
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;

