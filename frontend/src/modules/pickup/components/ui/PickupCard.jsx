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
    sm: "p-3",
    md: "p-4",
    lg: "p-5",
  };

  const variants = {
    default: "bg-white border border-slate-100 shadow-sm",
    elevated: "bg-white border border-slate-100 shadow-[var(--pickup-shadow)]",
    tinted: "bg-teal-50/60 border border-teal-100",
    dark: "bg-slate-900 text-white border border-slate-800",
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl sm:rounded-3xl",
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
