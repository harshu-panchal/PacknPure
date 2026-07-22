import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import PickupButton from "./PickupButton";
import { cn } from "../../utils/cn";

const PickupErrorState = ({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}) => (
  <div
    className={cn(
      "flex flex-col items-center rounded-[1.5rem] border border-rose-100/90",
      "bg-gradient-to-b from-rose-50/80 to-white px-6 py-10 text-center shadow-[var(--pickup-shadow-xs)]",
      "sm:rounded-[1.75rem]",
      className,
    )}
  >
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100/90 text-rose-500 shadow-inner ring-1 ring-rose-200/60">
      <AlertTriangle size={24} strokeWidth={2} />
    </div>
    <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-700">{title}</p>
    {message && (
      <p className="mt-2.5 max-w-xs text-sm font-medium leading-relaxed text-rose-600/75">
        {message}
      </p>
    )}
    {onRetry && (
      <PickupButton
        variant="danger"
        size="sm"
        icon={RefreshCw}
        onClick={onRetry}
        className="mt-5"
      >
        Try Again
      </PickupButton>
    )}
  </div>
);

export default PickupErrorState;
