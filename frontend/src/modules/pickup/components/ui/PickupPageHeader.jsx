import React from "react";
import { cn } from "../../utils/cn";

const PickupPageHeader = ({
  title,
  subtitle,
  icon: Icon,
  actions,
  sticky = true,
  className,
}) => (
  <header
    className={cn(
      "z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl",
      sticky && "sticky top-0",
      className,
    )}
  >
    <div className="pickup-safe-top pickup-safe-x mx-auto flex max-w-2xl items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-600/25">
            <Icon size={20} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  </header>
);

export default PickupPageHeader;
