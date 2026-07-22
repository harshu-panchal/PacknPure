import React from "react";
import { cn } from "../../utils/cn";

const PickupCard = ({
  children,
  className,
  padding = "md",
  variant = "default",
  ...props
}) => {
  const paddings = {
    none: "",
    sm: "p-3.5",
    md: "p-4 sm:p-5",
    lg: "p-5 sm:p-6",
  };

  const variants = {
    default:
      "bg-white/95 border border-slate-200/70 shadow-[var(--pickup-shadow)] backdrop-blur-sm",
    elevated:
      "bg-white border border-slate-100 shadow-[var(--pickup-shadow-md)]",
    tinted:
      "bg-gradient-to-br from-teal-50/90 to-white border border-teal-100/80 shadow-[var(--pickup-shadow-xs)]",
    dark:
      "bg-gradient-to-br from-slate-900 to-slate-800 text-white border border-slate-700/60 shadow-[var(--pickup-shadow-md)]",
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.25rem] sm:rounded-[1.5rem] transition-shadow duration-300",
        variants[variant],
        paddings[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default PickupCard;
