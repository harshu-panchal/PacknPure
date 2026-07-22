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
      "z-30 border-b border-slate-200/60 pickup-glass",
      "shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]",
      sticky && "sticky top-0",
      className,
    )}
  >
    <div className="pickup-safe-top pickup-safe-x mx-auto flex max-w-2xl items-center justify-between gap-3 py-3.5 sm:py-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon && (
          <div className="pickup-ring-live flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-[var(--pickup-shadow-glow)]">
            <Icon size={20} strokeWidth={2.25} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[1.05rem] font-black tracking-tight text-slate-900 sm:text-lg">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700/70">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      )}
    </div>
  </header>
);

export default PickupPageHeader;
