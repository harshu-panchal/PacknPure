import React, { useRef } from "react";
import { cn } from "../../utils/cn";

const PickupOtpInput = ({
  value = "",
  onChange,
  length = 6,
  disabled = false,
  className,
}) => {
  const inputsRef = useRef([]);

  const digits = value.padEnd(length, " ").slice(0, length).split("");

  const focusAt = (index) => {
    const el = inputsRef.current[index];
    if (el) el.focus();
  };

  const handleChange = (index, raw) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit || " ";
    const joined = next.join("").replace(/ /g, "");
    onChange?.(joined);
    if (digit && index < length - 1) focusAt(index + 1);
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      focusAt(index - 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pasted) onChange?.(pasted);
  };

  return (
    <div
      className={cn("flex justify-center gap-2 sm:gap-2.5", className)}
      onPaste={handlePaste}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          value={d.trim()}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-12 w-10 min-w-0 flex-1 max-w-[50px] rounded-2xl bg-slate-50/90 text-center text-lg font-black text-slate-900",
            "outline-none ring-1 ring-slate-200/80 shadow-[var(--pickup-shadow-xs)] transition-all duration-200",
            "focus:bg-white focus:ring-2 focus:ring-teal-500 focus:shadow-[0_0_0_4px_rgba(20,184,166,0.14)]",
            "sm:h-14 sm:w-12 sm:max-w-[56px] sm:text-xl",
            disabled && "opacity-50",
            d.trim() && "ring-teal-200 bg-teal-50/40",
          )}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
};

export default PickupOtpInput;
