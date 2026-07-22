import React from "react";
import { cn } from "../../utils/cn";

const PickupChip = ({ active, children, onClick, className, ...props }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "shrink-0 rounded-full px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-all duration-200",
      "min-h-[38px] active:scale-[0.96]",
      active
        ? "bg-gradient-to-b from-slate-800 to-slate-950 text-white shadow-[var(--pickup-shadow-md)]"
        : "border border-slate-200/90 bg-white/90 text-slate-500 shadow-[var(--pickup-shadow-xs)] hover:border-teal-200 hover:text-teal-700",
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

export default PickupChip;
