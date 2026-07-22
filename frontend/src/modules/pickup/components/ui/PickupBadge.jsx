import React from "react";
import { cn } from "../../utils/cn";

const PickupBadge = ({ children, variant = "default", className }) => {
  const variants = {
    default: "bg-slate-100/90 text-slate-600 ring-1 ring-slate-200/60",
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
    warning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200/70",
    danger: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/70",
    info: "bg-teal-50 text-teal-800 ring-1 ring-teal-200/70",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em]",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
};

export default PickupBadge;
