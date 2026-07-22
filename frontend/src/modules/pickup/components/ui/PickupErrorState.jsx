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
      "flex flex-col items-center rounded-2xl border border-rose-100 bg-rose-50/50 px-6 py-8 text-center sm:rounded-3xl",
      className,
    )}
  >
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-500">
      <AlertTriangle size={22} />
    </div>
    <p className="text-xs font-black uppercase tracking-widest text-rose-700">{title}</p>
    {message && (
      <p className="mt-2 max-w-xs text-xs font-medium text-rose-600/80">{message}</p>
    )}
    {onRetry && (
      <PickupButton
        variant="danger"
        size="sm"
        icon={RefreshCw}
        onClick={onRetry}
        className="mt-4"
      >
        Try Again
      </PickupButton>
    )}
  </div>
);

export default PickupErrorState;
