import React from "react";
import { cn } from "../../utils/cn";

const PickupEmptyState = ({
  icon: Icon,
  title = "Nothing here yet",
  description,
  action,
  className,
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200/90",
      "bg-gradient-to-b from-white to-slate-50/80 px-6 py-12 text-center shadow-[var(--pickup-shadow-xs)]",
      "sm:rounded-[1.75rem]",
      className,
    )}
  >
    {Icon && (
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-50 to-slate-50 text-teal-600/50 ring-1 ring-teal-100/80 shadow-inner">
        <Icon size={30} strokeWidth={1.75} />
      </div>
    )}
    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">{title}</p>
    {description && (
      <p className="mt-2.5 max-w-xs text-sm font-medium leading-relaxed text-slate-400">
        {description}
      </p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default PickupEmptyState;
