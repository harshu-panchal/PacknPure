import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Radio, PackageSearch, X, Check } from "lucide-react";
import { usePickupBroadcastContext } from "../context/PickupBroadcastContext";
import { PickupButton } from "./ui";
import orderAlertSound from "@/assets/order-alert.mp3";

/**
 * Full-screen, ringing accept/reject alert for the front of the broadcast
 * queue — the inline "Incoming Requests" card on the dashboard is easy to
 * miss if the partner isn't looking at that exact screen. This forces
 * attention the same way SellerItemRequestModal does for sellers, and keeps
 * ringing (looped, not one-shot) until the partner explicitly acts or the
 * broadcast expires on its own.
 */
const PickupBroadcastAlertModal = () => {
  const { broadcasts, acceptingId, acceptBroadcast, dismissBroadcast } =
    usePickupBroadcastContext();
  const active = broadcasts[0] || null;
  const audioRef = useRef(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const totalSecondsRef = useRef(60);

  useEffect(() => {
    if (!active) return undefined;

    if (!audioRef.current) {
      audioRef.current = new Audio(orderAlertSound);
      audioRef.current.loop = true;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});

    return () => {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    };
  }, [active]);

  useEffect(() => {
    if (!active?.expiresAt) {
      setSecondsLeft(0);
      return undefined;
    }
    const initialRem = Math.max(
      0,
      Math.floor((new Date(active.expiresAt).getTime() - Date.now()) / 1000),
    );
    totalSecondsRef.current = Math.max(1, initialRem);

    const tick = () => {
      const rem = Math.max(
        0,
        Math.floor((new Date(active.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(rem);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // Only re-capture the countdown baseline when a *different* broadcast
    // becomes the front of the queue, not on every expiresAt re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.requestId]);

  if (!active) return null;

  const isAccepting = acceptingId === active.requestId;
  const progressPercent = Math.max(
    0,
    Math.min(100, (secondsLeft / totalSecondsRef.current) * 100),
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-teal-400 bg-white shadow-2xl ring-4 ring-teal-500/20"
        >
          <div className="relative bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-300 ring-2 ring-teal-400/30 animate-pulse">
                <Radio className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="rounded-full bg-teal-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">
                  New Pickup Request
                </span>
                <h3 className="mt-1 truncate text-base font-black tracking-tight text-white sm:text-lg">
                  {active.vendorName || "A vendor"} needs pickup
                </h3>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-mono font-black uppercase tracking-widest text-teal-300 mb-1.5">
                <span>Time Remaining</span>
                <span className="text-lg font-black text-teal-300">{secondsLeft}s</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className={`h-full transition-all duration-1000 ${
                    secondsLeft <= 15
                      ? "bg-rose-500"
                      : secondsLeft <= 30
                        ? "bg-amber-400"
                        : "bg-teal-400"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-teal-600">
                <PackageSearch className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {active.itemSummary || "Products"}
                  {active.itemCount > 1 ? ` (+${active.itemCount - 1} more)` : ""}
                </p>
                <p className="text-xs font-semibold text-slate-500">{active.requestId}</p>
              </div>
            </div>

            {broadcasts.length > 1 && (
              <p className="text-center text-[11px] font-semibold text-slate-400">
                +{broadcasts.length - 1} more waiting in your list
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50 p-4">
            <PickupButton
              variant="secondary"
              icon={X}
              disabled={isAccepting}
              onClick={() => dismissBroadcast(active.requestId)}
            >
              Reject
            </PickupButton>
            <PickupButton
              variant="primary"
              icon={Check}
              loading={isAccepting}
              onClick={() => acceptBroadcast(active.requestId)}
            >
              Accept
            </PickupButton>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PickupBroadcastAlertModal;
