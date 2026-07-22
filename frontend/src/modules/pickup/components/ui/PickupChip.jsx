import React from "react";
import { cn } from "../../utils/cn";

const PickupChip = ({ active, children, onClick, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "shrink-0 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
      "min-h-[36px] active:scale-[0.97]",
      active
        ? "bg-slate-900 text-white shadow-md"
        : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300",
      className,
    )}
  >
    {children}
  </button>
);

export default PickupChip;
