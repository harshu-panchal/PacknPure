import React from "react";
import { cn } from "../../utils/cn";

const variants = {
  primary:
    "bg-gradient-to-b from-teal-500 to-teal-700 text-white shadow-[var(--pickup-shadow-glow)] hover:from-teal-400 hover:to-teal-600 active:scale-[0.97] active:shadow-md",
  secondary:
    "bg-white text-slate-700 border border-slate-200/90 shadow-[var(--pickup-shadow-xs)] hover:bg-slate-50 hover:border-slate-300 active:scale-[0.97]",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100/80 active:scale-[0.97]",
  danger:
    "bg-rose-50 text-rose-600 border border-rose-100/90 hover:bg-rose-100 active:scale-[0.97]",
  dark:
    "bg-gradient-to-b from-slate-800 to-slate-950 text-white shadow-[var(--pickup-shadow-md)] hover:from-slate-700 hover:to-slate-900 active:scale-[0.97]",
};

const sizes = {
  sm: "min-h-[42px] px-3.5 py-2 text-[10px]",
  md: "min-h-[50px] px-4 py-3 text-[11px]",
  lg: "min-h-[54px] px-5 py-3.5 text-xs",
};

const PickupButton = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className,
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  type = "button",
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-black uppercase tracking-[0.14em] transition-all duration-200 ease-out",
        "disabled:opacity-45 disabled:pointer-events-none disabled:active:scale-100 disabled:shadow-none",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90" />
          <span className="opacity-90">{children}</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={size === "sm" ? 14 : 16} className="shrink-0 opacity-95" />}
          {children}
          {IconRight && (
            <IconRight size={size === "sm" ? 14 : 16} className="shrink-0 opacity-95" />
          )}
        </>
      )}
    </button>
  );
};

export default PickupButton;
