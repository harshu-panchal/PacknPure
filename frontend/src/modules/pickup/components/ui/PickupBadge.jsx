import React from "react";
import { cn } from "../../utils/cn";

const PickupBadge = ({ children, variant = "default", className }) => {
  const variants = {
    default: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border border-amber-100",
    danger: "bg-rose-50 text-rose-600 border border-rose-100",
    info: "bg-teal-50 text-teal-700 border border-teal-100",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
};

export default PickupBadge;
