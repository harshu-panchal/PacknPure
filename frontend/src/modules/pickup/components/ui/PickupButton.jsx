import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

const variants = {
  primary:
    "bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-[0.98]",
  secondary:
    "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 active:scale-[0.98]",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 active:scale-[0.98]",
  danger:
    "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 active:scale-[0.98]",
  dark: "bg-slate-900 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800 active:scale-[0.98]",
};

const sizes = {
  sm: "min-h-[40px] px-3 py-2 text-[10px]",
  md: "min-h-[48px] px-4 py-3 text-xs",
  lg: "min-h-[52px] px-5 py-3.5 text-xs",
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
        "inline-flex items-center justify-center gap-2 rounded-2xl font-black uppercase tracking-widest transition-all duration-200",
        "disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={size === "sm" ? 14 : 16} className="shrink-0" />}
          {children}
          {IconRight && <IconRight size={size === "sm" ? 14 : 16} className="shrink-0" />}
        </>
      )}
    </button>
  );
};

export default PickupButton;
