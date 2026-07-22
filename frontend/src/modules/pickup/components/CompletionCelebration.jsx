import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { PickupButton } from "./ui";

const CompletionCelebration = ({ open, title = "Delivery complete!", onClose }) => {
  useEffect(() => {
    if (!open) return;
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 },
      colors: ["#0d9488", "#14b8a6", "#059669", "#f59e0b"],
    });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pickup-celebration-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle size={36} aria-hidden />
            </div>
            <h2 id="pickup-celebration-title" className="text-xl font-black text-slate-900">
              {title}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Great job! Your hub delivery has been recorded.
            </p>
            <PickupButton fullWidth className="mt-6" onClick={onClose} autoFocus>
              Continue
            </PickupButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CompletionCelebration;
