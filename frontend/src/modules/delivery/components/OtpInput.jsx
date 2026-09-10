import React, { useState, useRef, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle, Banknote, IndianRupee, Coins, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { deliveryApi } from "../services/deliveryApi";

/**
 * OtpInput Component
 * 
 * A 4-digit OTP input component for delivery personnel to validate delivery completion.
 * Features auto-focus, numeric keyboard on mobile, validation error handling, COD cash collection
 * confirmation, and attempts remaining counter.
 * 
 * Requirements: 5.1, 5.2, 6.5
 * 
 * @param {Object} props
 * @param {string} props.orderId - The order ID for OTP validation
 * @param {Object} [props.order] - The full order object
 * @param {boolean} [props.isCod=false] - Whether this order is Cash on Delivery
 * @param {number} [props.orderAmount=0] - Total order cash amount to collect
 * @param {string|number} [props.cashReceived=""] - Cash amount entered by rider
 * @param {boolean} [props.cashConfirmed=false] - Pre-confirmed cash status
 * @param {Function} props.onSuccess - Callback when OTP is successfully validated
 * @param {Function} props.onError - Callback when validation fails
 * @param {Function} props.onCancel - Optional callback for cancel action
 */
const OtpInput = ({
  orderId,
  order = null,
  isCod = false,
  orderAmount = 0,
  cashReceived = "",
  cashConfirmed = false,
  onSuccess,
  onError,
  onCancel,
}) => {
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [localCashConfirmed, setLocalCashConfirmed] = useState(cashConfirmed);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    setLocalCashConfirmed(cashConfirmed);
  }, [cashConfirmed]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (inputRefs[0].current) {
      inputRefs[0].current.focus();
    }
  }, []);

  // Reset component when orderId changes
  useEffect(() => {
    setOtp(["", "", "", ""]);
    setError(null);
    setAttemptsRemaining(3);
    setIsLoading(false);
    if (inputRefs[0].current) {
      inputRefs[0].current.focus();
    }
  }, [orderId]);

  /**
   * Handle input change for a specific digit
   * Implements auto-focus to next field on digit entry
   * Requirement 5.2: Accept exactly 4 numeric digits
   */
  const handleChange = (index, value) => {
    // Only allow numeric input
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);

    // Auto-focus next field if digit entered
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  /**
   * Handle keydown events for backspace navigation
   * Auto-focus previous field on backspace when current field is empty
   */
  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs[index - 1].current?.focus();
      return;
    }
    if (e.key === "ArrowRight" && index < 3) {
      e.preventDefault();
      inputRefs[index + 1].current?.focus();
    }
  };

  /**
   * Handle paste event to fill all fields at once
   */
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    
    // Only accept 4-digit numeric paste
    if (/^\d{4}$/.test(pastedData)) {
      const newOtp = pastedData.split("");
      setOtp(newOtp);
      setError(null);
      // Focus last input
      inputRefs[3].current?.focus();
    }
  };

  /**
   * Clear all input fields
   * Requirement 6.5: Clear input fields after failed validation
   */
  const clearInputs = () => {
    setOtp(["", "", "", ""]);
    setError(null);
    inputRefs[0].current?.focus();
  };

  /**
   * Submit OTP for validation
   * Requirement 5.1: Display OTP input field for delivery person
   * Requirement 6.5: Show attempts remaining counter
   */
  const handleSubmit = async () => {
    const otpString = otp.join("");

    // Validate OTP format before submission
    if (otpString.length !== 4) {
      setError("Please enter all 4 digits");
      return;
    }

    // If Cash on Delivery, ensure the delivery person acknowledges cash collection
    if (isCod && !localCashConfirmed) {
      setError(`Please confirm that you have collected ₹${orderAmount} in cash from the customer.`);
      toast.error(`Please collect ₹${orderAmount} in cash and check the confirmation box.`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call validate-otp endpoint with cash collection metadata
      const response = await deliveryApi.validateDeliveryOtp(orderId, {
        otp: otpString,
        cashCollected: isCod ? Number(cashReceived || orderAmount) : 0,
      });

      // Success - navigate to success screen
      toast.success(response.data?.message || "Order delivered successfully!");
      
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      // Handle validation errors
      const errorData = err.response?.data?.error;
      const errorCode = errorData?.code;
      const errorMessage = errorData?.message || "Failed to validate OTP";
      const remainingAttempts = errorData?.attemptsRemaining;

      // Update attempts remaining if provided
      if (typeof remainingAttempts === "number") {
        setAttemptsRemaining(remainingAttempts);
      }

      // Display appropriate error message
      if (errorCode === "OTP_MISMATCH") {
        setError(`Incorrect OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining.`);
        toast.error(`Incorrect OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining.`);
        clearInputs();
      } else if (errorCode === "OTP_EXPIRED") {
        setError("OTP has expired. Please generate a new one.");
        toast.error("OTP has expired. Please generate a new one.");
      } else if (errorCode === "MAX_ATTEMPTS_EXCEEDED") {
        setError("Maximum attempts exceeded. Please contact supervisor.");
        toast.error("Maximum attempts exceeded. Please contact supervisor.", {
          duration: 6000,
        });
      } else if (errorCode === "OTP_INVALID_FORMAT") {
        setError("Invalid OTP format. Please enter 4 digits.");
        toast.error("Invalid OTP format. Please enter 4 digits.");
        clearInputs();
      } else if (errorCode === "OTP_NOT_FOUND") {
        setError("No active OTP found. Please generate one first.");
        toast.error("No active OTP found. Please generate one first.");
      } else {
        setError(errorMessage);
        toast.error(errorMessage);
      }

      if (onError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Check if all 4 digits are entered
  const isComplete = otp.every((digit) => digit !== "");

  return (
    <div className="space-y-5">
      {/* Cash on Delivery / Prepaid Banner */}
      {isCod ? (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
                <Banknote size={20} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 leading-none">
                  Cash on Delivery
                </p>
                <h4 className="text-lg font-black text-amber-950 dark:text-amber-100 mt-0.5">
                  Collect ₹{orderAmount}
                </h4>
              </div>
            </div>
            <span className="text-[10px] font-black bg-orange-600 text-white px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm animate-pulse">
              Cash Required
            </span>
          </div>

          <label className="flex items-center gap-2.5 mt-2.5 cursor-pointer bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-amber-200 dark:border-amber-700/50 select-none">
            <input
              type="checkbox"
              checked={localCashConfirmed}
              onChange={(e) => setLocalCashConfirmed(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
              I confirm I have collected ₹{orderAmount} cash from customer
            </span>
          </label>
        </div>
      ) : (
        orderAmount > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <CheckCircle size={18} className="text-emerald-600 shrink-0" />
              <span className="text-xs font-bold">Prepaid Order (₹{orderAmount}) — No cash to collect</span>
            </div>
            <span className="text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full">
              Paid Online
            </span>
          </div>
        )
      )}

      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
          Enter Delivery OTP
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Ask the customer for the 4-digit code {isCod ? "after collecting cash" : ""}
        </p>
      </div>

      {/* OTP Input Fields */}
      <div className="flex justify-center gap-3" role="group" aria-label="One-time password">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={inputRefs[index]}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={isLoading}
            aria-invalid={!!error}
            className={`w-14 h-16 text-center text-2xl font-bold font-mono border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              error
                ? "border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500"
                : digit
                ? "border-green-500 bg-green-50 text-green-900 focus:border-green-600 focus:ring-green-500"
                : "border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-blue-500"
            } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            aria-label={`Digit ${index + 1} of 4`}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 font-medium">{error}</p>
        </div>
      )}

      {/* Attempts Remaining Counter */}
      {/* Requirement 6.5: Show attempts remaining counter */}
      {attemptsRemaining < 3 && attemptsRemaining > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-sm text-amber-800 font-medium">
            {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining
          </p>
        </div>
      )}

      {/* Submit Button */}
      {/* Enable submit button only when 4 digits entered */}
      <button
        onClick={handleSubmit}
        disabled={!isComplete || isLoading}
        className={`w-full h-12 rounded-xl font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 ${
          !isComplete || isLoading
            ? "bg-gray-300 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700 active:scale-95 shadow-md hover:shadow-lg"
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Validating...</span>
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" />
            <span>Confirm Delivery</span>
          </>
        )}
      </button>

      {/* Clear Button */}
      <button
        onClick={clearInputs}
        disabled={isLoading || otp.every((d) => !d)}
        className="w-full h-10 rounded-xl font-medium text-gray-700 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Clear
      </button>

      {/* Cancel Button (Optional) */}
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="w-full h-10 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:text-gray-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <p className="text-xs text-blue-800 text-center">
          💡 The customer will see this OTP on their app when you're nearby
        </p>
      </div>
    </div>
  );
};

export default OtpInput;
