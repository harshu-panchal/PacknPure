import React from "react";
import { Check } from "lucide-react";
import { cn } from "../../utils/cn";

const STEP_COLORS = [
  "border-teal-200 bg-teal-50 text-teal-800",
  "border-teal-200 bg-teal-50 text-teal-800",
  "border-slate-200 bg-slate-50 text-slate-700",
  "border-teal-200 bg-teal-50 text-teal-800",
  "border-violet-200 bg-violet-50 text-violet-800",
  "border-emerald-200 bg-emerald-50 text-emerald-800",
];

/**
 * Horizontal step indicator for pickup workflow.
 */
const PickupStepIndicator = ({ steps = [], currentStep = 0, className }) => {
  if (!steps.length) return null;

  return (
    <div className={cn("w-full min-w-0 overflow-x-auto pb-1", className)}>
      <div className="flex min-w-max items-center gap-1.5 px-0.5">
        {steps.map((step, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
          const color = STEP_COLORS[index % STEP_COLORS.length];

          return (
            <React.Fragment key={step.id || index}>
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 transition-all duration-200",
                  done && "border-emerald-200/90 bg-emerald-50 text-emerald-700 shadow-[var(--pickup-shadow-xs)]",
                  active && !done && cn(color, "shadow-[var(--pickup-shadow-xs)] scale-[1.02]"),
                  !done && !active && "border-slate-100 bg-white/80 text-slate-400",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black",
                    done && "bg-emerald-500 text-white shadow-sm",
                    active && !done && "bg-teal-600/15 text-teal-800",
                    !done && !active && "bg-slate-100",
                  )}
                >
                  {done ? <Check size={10} strokeWidth={3} /> : index + 1}
                </span>
                <span className="max-w-[72px] truncate text-[9px] font-black uppercase tracking-wide sm:max-w-none">
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-[2px] w-3 shrink-0 rounded-full sm:w-4",
                    index < currentStep ? "bg-emerald-300" : "bg-slate-200",
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default PickupStepIndicator;
