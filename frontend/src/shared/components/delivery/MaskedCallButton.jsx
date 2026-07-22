import React, { useState } from "react";
import { Phone, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Initiates a masked call via backend — never exposes personal numbers.
 * @param {object} props
 * @param {string} props.orderId
 * @param {"customer"|"delivery"} props.role
 * @param {() => Promise<{data?: object}>} props.initiateCall
 * @param {string} [props.className]
 * @param {boolean} [props.compact]
 * @param {boolean} [props.disabled]
 */
export default function MaskedCallButton({
  orderId,
  role = "customer",
  initiateCall,
  className,
  compact = false,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);

  const handleCall = async () => {
    if (!orderId || !initiateCall || loading || disabled) return;
    setLoading(true);
    try {
      const res = await initiateCall(orderId);
      const session = res?.data?.result || res?.data?.data;
      const masked = session?.maskedNumber;
      toast.success(
        masked
          ? `Connecting via masked number ${masked}`
          : "Masked call initiated — your number stays private",
      );
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Could not start masked call. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleCall}
        disabled={disabled || loading}
        aria-label="Call via masked number"
        className={cn(
          "flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-rose-50 text-[#E23744] transition-colors hover:bg-rose-100 disabled:opacity-50",
          className,
        )}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCall}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-[#E23744] transition-colors hover:bg-rose-100 disabled:opacity-50 sm:w-auto",
        className,
      )}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <Phone size={18} />
      )}
      <span>Call {role === "delivery" ? "Customer" : "Partner"}</span>
      <Shield size={14} className="opacity-70" aria-hidden />
    </button>
  );
}
