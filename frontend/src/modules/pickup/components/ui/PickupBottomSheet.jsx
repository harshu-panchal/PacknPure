import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";

const PickupBottomSheet = ({ open, onClose, title, children, className }) => (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
        <motion.button
          type="button"
          aria-label="Close"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/55 backdrop-blur-[6px]"
          onClick={onClose}
        />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "pickup-sheet-title" : undefined}
          initial={{ y: "100%", opacity: 0.9 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0.9 }}
          transition={{ type: "spring", damping: 30, stiffness: 340 }}
          className={cn(
            "relative z-10 w-full max-w-md rounded-t-[1.75rem] bg-white p-5 shadow-[var(--pickup-shadow-lg)] sm:rounded-[1.75rem] sm:p-6",
            "max-h-[90dvh] overflow-y-auto border border-slate-100/80",
            "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
            className,
          )}
        >
          <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-slate-200/90 sm:hidden" />
          {(title || onClose) && (
            <div className="mb-5 flex items-start justify-between gap-3">
              {title && (
                <h2
                  id="pickup-sheet-title"
                  className="text-lg font-black tracking-tight text-slate-900"
                >
                  {title}
                </h2>
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 active:scale-95"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}
          {children}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default PickupBottomSheet;
