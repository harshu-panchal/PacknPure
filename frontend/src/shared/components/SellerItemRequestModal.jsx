import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HiOutlineExclamationTriangle,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClock,
  HiOutlineBuildingStorefront,
  HiOutlineCube,
  HiOutlineCurrencyRupee,
} from "react-icons/hi2";
import Button from "@shared/components/ui/Button";
import { useToast } from "@shared/components/ui/Toast";
import { sellerApi } from "@/modules/seller/services/sellerApi";
import { getOrderSocket } from "@core/services/orderSocket";

/** Play subtle audio chime on new request alert */
const playAlertChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    /* Web Audio API fallback silent */
  }
};

export const SellerItemRequestModal = ({ isSeller = false }) => {
  const { showToast } = useToast();
  const [activeRequest, setActiveRequest] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(52);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isSeller) return;

    const tokenGetter = () => {
      const val = localStorage.getItem("auth_seller");
      if (!val) return null;
      if (val.startsWith("{")) {
        try {
          return JSON.parse(val).token || val;
        } catch {
          return val;
        }
      }
      return val;
    };

    const socket = getOrderSocket(tokenGetter);

    const handleNewPR = (payload) => {
      if (!payload || !payload.purchaseRequestId) return;

      playAlertChime();

      let initialSeconds = 52;
      if (payload.expiresAt) {
        const expMs = new Date(payload.expiresAt).getTime();
        const nowMs = Date.now() - (window.__serverTimeOffset || 0);
        const rem = Math.floor((expMs - nowMs) / 1000);
        if (rem > 0 && rem <= 300) {
          initialSeconds = rem;
        }
      }

      setActiveRequest(payload);
      setSecondsLeft(initialSeconds);
      showToast("Urgent Item Request Received! (52s Alert)", "info");
    };

    if (socket) {
      socket.on("purchase_request:new", handleNewPR);
    }

    // Active PR poll fallback (checks for open purchase requests on mount & every 8s)
    let pollInterval = null;
    const fetchOpenPRs = async () => {
      try {
        const res = await sellerApi.getPurchaseRequests({ status: "created" });
        const list = res?.data?.result?.items || res?.data?.results || [];
        const openPRs = Array.isArray(list) ? list : [];

        if (openPRs.length > 0) {
          const firstPR = openPRs[0];
          const expMs = firstPR.expiresAt ? new Date(firstPR.expiresAt).getTime() : Date.now() + 52000;
          const nowMs = Date.now();
          const rem = Math.floor((expMs - nowMs) / 1000);

          if (rem > 0) {
            const mappedItems = (firstPR.items || []).map((it) => ({
              productId: it.productId?._id || it.productId,
              productName: it.productId?.name || it.productName || "Requested Product",
              mainImage: it.productId?.mainImage || it.mainImage || "",
              variantId: it.variantId || null,
              requestedQty: it.requestedQty || it.shortageQty || 1,
              unitCost: it.vendorUnitCost || it.finalSupplyPrice || 0,
              totalCost: it.totalProcurementCost || (it.vendorUnitCost || 0) * (it.requestedQty || 1),
            }));
            const mappedPayload = {
              orderId: firstPR.orderId?.orderId || firstPR.orderId || "",
              purchaseRequestId: firstPR._id?.toString() || firstPR.id,
              requestId: firstPR.requestId,
              hubId: firstPR.hubId || "MAIN_HUB",
              itemsCount: firstPR.items?.length || 0,
              totalAmount: mappedItems.reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0),
              expiresAt: firstPR.expiresAt,
              timeoutSeconds: rem,
              items: mappedItems,
            };

            setActiveRequest((prev) => {
              if (!prev || prev.purchaseRequestId !== mappedPayload.purchaseRequestId) {
                playAlertChime();
                setSecondsLeft(rem);
                showToast("Urgent Item Request Received! (52s Alert)", "info");
                return mappedPayload;
              }
              return prev;
            });
          }
        }
      } catch {
        /* silent poll catch */
      }
    };

    void fetchOpenPRs();
    pollInterval = setInterval(fetchOpenPRs, 8000);

    return () => {
      if (socket) socket.off("purchase_request:new", handleNewPR);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isSeller, showToast]);

  // Real-time 52-second countdown timer
  useEffect(() => {
    if (!activeRequest) return;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          showToast("Item request timer expired (52s)", "warning");

          if (activeRequest?.purchaseRequestId) {
            sellerApi
              .respondPurchaseRequest(activeRequest.purchaseRequestId, {
                action: "reject_line",
                rejectionReason: "Seller 52s alert timed out",
                notes: "Automatic timeout fallback trigger",
              })
              .catch(() => {});
          }

          setTimeout(() => setActiveRequest(null), 1200);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeRequest, showToast]);

  const handleAccept = async () => {
    if (!activeRequest || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const prId = activeRequest.purchaseRequestId;
      
      // Check if items present
      if (Array.isArray(activeRequest.items) && activeRequest.items.length > 0) {
        const itemsToCommit = activeRequest.items.map((it) => ({
          productId: String(it.productId),
          variantId: it.variantId || null,
          committedQty: Number(it.requestedQty || it.shortageQty || 1),
        }));
        await sellerApi.respondPurchaseRequest(prId, {
          action: "accept",
          notes: "Accepted via 52-second real-time alert modal",
          items: itemsToCommit,
        });
      } else {
        await sellerApi.respondPurchaseRequest(prId, {
          action: "accept",
          notes: "Accepted via 52-second real-time alert modal",
        });
      }

      showToast("Item procurement accepted! Stock committed.", "success");
      setActiveRequest(null);
    } catch (err) {
      console.error("Failed to accept item request:", err);
      showToast(
        err?.response?.data?.message || "Failed to accept item request",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!activeRequest || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const prId = activeRequest.purchaseRequestId;
      await sellerApi.respondPurchaseRequest(prId, {
        action: "reject_line",
        rejectionReason: "Rejected via 52-second alert modal",
        notes: "Out of stock / Rejected by seller",
      });

      showToast("Item request rejected.", "info");
      setActiveRequest(null);
    } catch (err) {
      console.error("Failed to reject item request:", err);
      showToast(
        err?.response?.data?.message || "Failed to reject item request",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeRequest) return null;

  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / 52) * 100));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border-2 border-amber-400 bg-white shadow-2xl ring-4 ring-amber-500/20"
        >
          {/* Header Bar with Pulsing Alert Badge */}
          <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 ring-2 ring-amber-400/30 animate-pulse">
                  <HiOutlineExclamationTriangle className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">
                      Hub Shortage Alert
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {activeRequest.requestId || activeRequest.orderId}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-black tracking-tight text-white sm:text-lg">
                    Item Not Present in Admin Hub
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setActiveRequest(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                title="Dismiss"
              >
                <HiOutlineXCircle className="h-6 w-6" />
              </button>
            </div>

            {/* Countdown Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-mono font-black uppercase tracking-widest text-amber-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <HiOutlineClock className="h-4 w-4 animate-spin text-amber-400" />
                  Time Remaining
                </span>
                <span className="text-lg font-black text-amber-300">
                  {secondsLeft}s
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className={`h-full transition-all duration-1000 ${
                    secondsLeft <= 15
                      ? "bg-rose-500"
                      : secondsLeft <= 30
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-600">
              Customer ordered item(s) that are unavailable at Main Hub. Stock is available in your inventory — accept to fulfill this request.
            </p>

            {/* Item List */}
            <div className="space-y-3">
              {(activeRequest.items || []).map((item, idx) => (
                <div
                  key={item.productId || idx}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {item.mainImage ? (
                      <img
                        src={item.mainImage}
                        alt={item.productName || "Product"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                        <HiOutlineCube className="h-7 w-7" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {item.productName || "Requested Product"}
                    </h4>
                    {item.variantName && (
                      <p className="text-xs text-slate-500 font-medium">
                        Variant: {item.variantName}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center justify-between text-xs">
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                        Qty: {item.requestedQty || item.shortageQty || 1} units
                      </span>
                      {item.unitCost > 0 && (
                        <span className="font-black text-emerald-700">
                          ₹{Number(item.totalCost || item.unitCost * (item.requestedQty || 1)).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Hub & Pricing Info */}
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-100/60 p-3 text-xs">
              <div className="flex items-center gap-2">
                <HiOutlineBuildingStorefront className="h-5 w-5 text-indigo-600 shrink-0" />
                <div>
                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Destination Hub
                  </p>
                  <p className="font-black text-slate-800 truncate">
                    {activeRequest.hubId || "MAIN_HUB"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <HiOutlineCurrencyRupee className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Total Order Value
                  </p>
                  <p className="font-black text-slate-900 text-sm">
                    ₹{Number(activeRequest.totalAmount || 0).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Action Footer */}
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50 p-4">
            <Button
              variant="outline"
              onClick={handleReject}
              isLoading={isSubmitting}
              disabled={isSubmitting || secondsLeft === 0}
              className="w-full rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50 font-black"
            >
              <HiOutlineXCircle className="h-5 w-5 mr-1.5 inline" />
              Reject Request
            </Button>
            <Button
              onClick={handleAccept}
              isLoading={isSubmitting}
              disabled={isSubmitting || secondsLeft === 0}
              className="w-full rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 font-black shadow-lg shadow-emerald-600/30"
            >
              <HiOutlineCheckCircle className="h-5 w-5 mr-1.5 inline" />
              Accept (Commit)
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SellerItemRequestModal;
