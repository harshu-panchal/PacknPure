import React from "react";
import { cn } from "../../utils/cn";

const PickupInput = ({
  label,
  icon: Icon,
  hint,
  error,
  className,
  inputClassName,
  ...props
}) => (
  <div className={cn("space-y-1.5", className)}>
    {label && (
      <label className="ml-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label}
      </label>
    )}
    <div className="relative group">
      {Icon && (
        <Icon
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-teal-600"
        />
      )}
      <input
        className={cn(
          "w-full min-w-0 rounded-2xl border-none bg-slate-50 py-3.5 text-sm font-semibold text-slate-900 outline-none",
          "ring-1 ring-slate-100 transition-all placeholder:text-slate-400",
          "focus:ring-2 focus:ring-teal-600 disabled:opacity-60",
          Icon ? "pl-10 pr-4" : "px-4",
          error && "ring-rose-300 focus:ring-rose-500",
          inputClassName,
        )}
        {...props}
      />
    </div>
    {hint && !error && (
      <p className="ml-1 text-[10px] font-medium text-slate-400">{hint}</p>
    )}
    {error && (
      <p className="ml-1 text-[10px] font-semibold text-rose-500">{error}</p>
    )}
  </div>
);

export default PickupInput;
