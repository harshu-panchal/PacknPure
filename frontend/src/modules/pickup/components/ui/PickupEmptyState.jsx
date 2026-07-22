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
      "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center sm:rounded-3xl",
      className,
    )}
  >
    {Icon && (
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
        <Icon size={28} />
      </div>
    )}
    <p className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</p>
    {description && (
      <p className="mt-2 max-w-xs text-xs font-medium leading-relaxed text-slate-400">
        {description}
      </p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default PickupEmptyState;
