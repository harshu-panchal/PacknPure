import React, { useId } from "react";
import { cn } from "../../utils/cn";

const PickupInput = ({
  label,
  icon: Icon,
  hint,
  error,
  className,
  inputClassName,
  id: idProp,
  ...props
}) => {
  const autoId = useId();
  const inputId = idProp || autoId;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="ml-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400"
        >
          {label}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <Icon
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors duration-200 group-focus-within:text-teal-600"
            aria-hidden
          />
        )}
        <input
          id={inputId}
          className={cn(
            "w-full min-w-0 rounded-2xl border-none bg-slate-50/90 py-3.5 text-sm font-semibold text-slate-900 outline-none",
            "ring-1 ring-slate-200/80 shadow-[var(--pickup-shadow-xs)] transition-all duration-200 placeholder:text-slate-400",
            "focus:bg-white focus:ring-2 focus:ring-teal-500/80 focus:shadow-[0_0_0_4px_rgba(20,184,166,0.12)]",
            "disabled:opacity-60",
            Icon ? "pl-10 pr-4" : "px-4",
            error && "ring-rose-300 focus:ring-rose-500 focus:shadow-[0_0_0_4px_rgba(225,29,72,0.1)]",
            inputClassName,
          )}
          aria-invalid={error ? "true" : undefined}
          {...props}
        />
      </div>
      {hint && !error && (
        <p className="ml-1 text-[10px] font-medium text-slate-400">{hint}</p>
      )}
      {error && (
        <p className="ml-1 text-[10px] font-semibold text-rose-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default PickupInput;
