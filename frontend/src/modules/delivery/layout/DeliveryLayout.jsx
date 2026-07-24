import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { BellRing, MapPin } from "lucide-react";
import { deliveryApi } from "../services/deliveryApi";
import { useAuth } from "@/core/context/AuthContext";
import {
  getOrderSocket,
  onDeliveryBroadcast,
  onDeliveryBroadcastWithdrawn,
} from "@/core/services/orderSocket";
import {
  loadHandledIncomingOrderIds,
  markIncomingOrderHandled,
} from "../utils/deliveryHandledOrders";
import { saveDeliveryPartnerLocation } from "../utils/deliveryLastLocation";

/** Match server `deliverySearchExpiresAt` — progress bar + countdown stay aligned when modal opens late. */
function secondsLeftUntilDeliveryExpiry(expiresAt) {
  if (!expiresAt) return 60;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

function playIncomingOrderAlert() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([80, 40, 80, 40, 160]);
    }
  } catch {
    /* vibrate optional */
  }
  try {
    const audio = new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
    );
    audio.volume = 1;
    audio.play().catch(() => {});
  } catch {
    /* audio optional */
  }
}

function showBrowserOrderNotification({ title, body, orderId, onClick }) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;

  const spawn = () => {
    try {
      const n = new Notification(title, {
        body,
        tag: `delivery-order-${orderId}`,
        renotify: true,
        requireInteraction: true,
        silent: false,
      });
      n.onclick = () => {
        try {
          window.focus();
          onClick?.();
        } catch {
          /* ignore */
        }
        n.close();
      };
    } catch {
      /* Notification constructor may fail in some browsers */
    }
  };

  if (Notification.permission === "granted") {
    spawn();
    return;
  }
  if (Notification.permission === "default") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") spawn();
    });
  }
}

const DeliveryLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeOrder, setActiveOrder] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [acceptWindowTotal, setAcceptWindowTotal] = useState(60);
  const shownOrderIdsRef = useRef(new Set());
  const activeOrderRef = useRef(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [availableOrdersCount, setAvailableOrdersCount] = useState(0);
  const [isAcceptingOrder, setIsAcceptingOrder] = useState(false);
  const acceptInFlightRef = useRef(false);

  useEffect(() => {
    activeOrderRef.current = activeOrder;
  }, [activeOrder]);

  /** While working an active order, do not stack the global incoming-offer modal (fixes refresh on order details). */
  const suppressIncomingModal = useMemo(
    () =>
      /\/delivery\/(order-details|confirm-delivery|navigation)/.test(location.pathname),
    [location.pathname],
  );

  useEffect(() => {
    loadHandledIncomingOrderIds().forEach((id) => shownOrderIdsRef.current.add(id));

    // Initialize Dark Mode setting for Delivery App
    try {
      const savedSettings = localStorage.getItem('deliveryAppSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    } catch (e) {
      // ignore dark-mode init errors
    }
  }, []);

  const applyFromBroadcastPayload = useCallback((payload) => {
    if (!payload?.orderId) return false;
    if (activeOrderRef.current) return true;
    if (shownOrderIdsRef.current.has(payload.orderId)) return true;
    const p = payload.preview;
    if (
      !p ||
      typeof p.pickup !== "string" ||
      (typeof p.drop !== "string" && typeof p.drop !== "number") ||
      String(p.drop).trim() === ""
    ) {
      return false;
    }
    const exp = payload.deliverySearchExpiresAt;
    if (exp && secondsLeftUntilDeliveryExpiry(exp) <= 0) {
      return false;
    }
    shownOrderIdsRef.current = new Set(shownOrderIdsRef.current).add(payload.orderId);
    const total = typeof p.total === "number" ? p.total : Number(p.total) || 0;
    const dropLabel = typeof p.drop === "string" ? p.drop : String(p.drop);
    setActiveOrder({
      id: payload.orderId,
      mongoId: undefined,
      pickup: p.pickup,
      drop: dropLabel,
      distance: "Nearby",
      estTime: "10-15 min",
      value: total,
      earnings: Math.max(p.deliveryFee ?? 0, 25), // Ensure minimum ₹25 earning even if delivery is free
      expiresAt: payload.deliverySearchExpiresAt || null,
    });
    playIncomingOrderAlert();
    showBrowserOrderNotification({
      title: "Packnpure · New delivery",
      body: `₹${Math.max(p.deliveryFee ?? 0, 25)} · ${p.pickup} → ${dropLabel}`,
      orderId: payload.orderId,
    });
    return true;
  }, []);

  const applyAvailableOrdersList = useCallback((availableOrders) => {
    setAvailableOrdersCount(availableOrders.length);
    if (activeOrderRef.current) return;
    const newOrder = availableOrders.find((o) => {
      if (shownOrderIdsRef.current.has(o.orderId)) return false;
      if (
        o.deliverySearchExpiresAt &&
        secondsLeftUntilDeliveryExpiry(o.deliverySearchExpiresAt) <= 0
      ) {
        return false;
      }
      return true;
    });
    if (!newOrder) return;
    shownOrderIdsRef.current = new Set(shownOrderIdsRef.current).add(newOrder.orderId);
    const total = newOrder.pricing?.total || 0;
    const pickupLabel = newOrder.hubFlowEnabled
      ? newOrder.pickupAddress || (newOrder.hubId ? `Hub ${newOrder.hubId}` : "Hub")
      : newOrder.seller?.shopName || "Seller";
    const dropLabel = newOrder.address?.address || "Customer Address";
    setActiveOrder({
      id: newOrder.orderId,
      mongoId: newOrder._id,
      pickup: pickupLabel,
      drop: dropLabel,
      distance: "Nearby",
      estTime: "10-15 min",
      value: total,
      earnings: Math.max(newOrder.pricing?.deliveryFee ?? 0, 25), // Ensure minimum ₹25 earning even if delivery is free
      expiresAt: newOrder.deliverySearchExpiresAt || null,
    });
    playIncomingOrderAlert();
    showBrowserOrderNotification({
      title: "Packnpure · New delivery",
      body: `₹${Math.max(newOrder.pricing?.deliveryFee ?? 0, 25)} · ${pickupLabel} → ${dropLabel}`,
      orderId: newOrder.orderId,
    });
  }, []);

  const hideBottomNavRoutes = [
    "/delivery/login",
    "/delivery/auth",
    "/delivery/splash",
    "/delivery/navigation",
    "/delivery/confirm-delivery",
    "/delivery/order-details",
  ];

  const shouldShowBottomNav = !hideBottomNavRoutes.some((route) =>
    location.pathname.includes(route),
  );

  // Polling for available orders
  useEffect(() => {
    const fetchOrders = async () => {
      // Only poll if online and NOT currently in an active order alert
      if (!user?.isOnline || activeOrder || suppressIncomingModal) return;

      try {
        const res = await deliveryApi.getAvailableOrders();
        if (res.data.success) {
          const availableOrders = res.data.results || res.data.result || [];
          applyAvailableOrdersList(availableOrders);
        }
      } catch (error) {
        // polling failures are non-blocking
      } finally {
        if (isFirstLoad) setIsFirstLoad(false);
      }
    };

    if (user?.isOnline) {
      fetchOrders(); // Initial fetch when going online
      const interval = setInterval(fetchOrders, 5000);
      return () => clearInterval(interval);
    }
  }, [user?.isOnline, activeOrder, applyAvailableOrdersList, suppressIncomingModal]);

  // Real-time location while online — required for seller service-radius matching on new orders
  useEffect(() => {
    if (!user?.isOnline || typeof navigator === "undefined" || !navigator.geolocation) {
      return undefined;
    }

    const send = (lat, lng) => {
      saveDeliveryPartnerLocation(lat, lng);
      deliveryApi.postLocation({ lat, lng }).catch(() => {});
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        send(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 30000,
      },
    );

    const iv = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => send(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 },
      );
    }, 20000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(iv);
    };
  }, [user?.isOnline]);

  useEffect(() => {
    if (!user?.isOnline) return undefined;
    const getToken = () => localStorage.getItem("auth_delivery");
    getOrderSocket(getToken);
    return onDeliveryBroadcast(getToken, (payload) => {
      if (activeOrderRef.current || suppressIncomingModal) return;
      const opened = applyFromBroadcastPayload(payload);
      if (opened) return;
      deliveryApi
        .getAvailableOrders()
        .then((res) => {
          if (res.data.success) {
            const list = res.data.results || res.data.result || [];
            applyAvailableOrdersList(list);
          }
        })
        .catch(() => {});
    });
  }, [user?.isOnline, applyAvailableOrdersList, applyFromBroadcastPayload, suppressIncomingModal]);

  useEffect(() => {
    if (!user?.isOnline) return undefined;
    const getToken = () => localStorage.getItem("auth_delivery");
    return onDeliveryBroadcastWithdrawn(getToken, (payload) => {
      const orderId = payload?.orderId;
      if (!orderId) return;

      shownOrderIdsRef.current = new Set(shownOrderIdsRef.current).add(orderId);
      markIncomingOrderHandled(orderId);

      if (activeOrderRef.current?.id === orderId) {
        acceptInFlightRef.current = false;
        setIsAcceptingOrder(false);
        setActiveOrder(null);
        toast.info("Another delivery partner accepted this order.");
      }
    });
  }, [user?.isOnline]);

  const skipOrder = useCallback(async () => {
    const current = activeOrderRef.current;
    if (!current || acceptInFlightRef.current) return;
    try {
      await deliveryApi.skipOrder(current.id);
      shownOrderIdsRef.current = new Set(shownOrderIdsRef.current).add(current.id);
      markIncomingOrderHandled(current.id);
      setActiveOrder(null);
      toast.info("Order skipped");
    } catch (error) {
      setActiveOrder(null);
    }
  }, []);

  // Incoming-order modal: scroll lock + Escape rejects (same as Reject)
  useEffect(() => {
    if (!activeOrder) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape" && !acceptInFlightRef.current) {
        e.preventDefault();
        skipOrder();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeOrder, skipOrder]);

  // Countdown from server deadline (same idea as seller panel)
  useEffect(() => {
    if (!activeOrder) return undefined;
    const left = secondsLeftUntilDeliveryExpiry(activeOrder.expiresAt);
    if (left <= 0) {
      if (!acceptInFlightRef.current) {
        skipOrder();
        toast.error("Order request timed out");
      }
      return undefined;
    }
    setAcceptWindowTotal(left);
    setTimeLeft(left);
    const timer = setInterval(() => {
      const next = secondsLeftUntilDeliveryExpiry(activeOrderRef.current?.expiresAt);
      setTimeLeft(next);
      if (next <= 0) {
        clearInterval(timer);
        if (!acceptInFlightRef.current) {
          skipOrder();
          toast.error("Order request timed out");
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activeOrder, skipOrder]);

  const handleAcceptOrder = async () => {
    if (!activeOrder || acceptInFlightRef.current) return;
    if (
      activeOrder.expiresAt &&
      secondsLeftUntilDeliveryExpiry(activeOrder.expiresAt) <= 0
    ) {
      toast.error("This request has expired. Try the next one.");
      setActiveOrder(null);
      return;
    }
    acceptInFlightRef.current = true;
    setIsAcceptingOrder(true);
    const orderId = activeOrder.id;
    try {
      const idem =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`;
      await deliveryApi.acceptOrder(orderId, idem);
      toast.success("Order accepted!");
      shownOrderIdsRef.current = new Set(shownOrderIdsRef.current).add(orderId);
      markIncomingOrderHandled(orderId);
      setActiveOrder(null);
      // Go straight into the active delivery flow (tracking / next steps)
      navigate(`/delivery/order-details/${encodeURIComponent(orderId)}`, {
        replace: true,
      });
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        (typeof error.response?.data === "string" ? error.response.data : null);
      toast.error(msg || "Failed to accept order");
      // Keep modal open on failure so rider can retry or reject — unless another rider took it
      if (
        error.response?.status === 409 ||
        /already|expired|not available|no longer open/i.test(String(msg || ""))
      ) {
        setActiveOrder(null);
      }
    } finally {
      acceptInFlightRef.current = false;
      setIsAcceptingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans max-w-md mx-auto relative shadow-2xl overflow-x-hidden border-x border-gray-100 dark:border-gray-800 transition-colors">
      {/* App-style heads-up notification — slides from top like native delivery apps */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {activeOrder && (
              <motion.div
                key={`overlay-${activeOrder.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/55 backdrop-blur-[2px] pt-[max(0.75rem,env(safe-area-inset-top))] px-3"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delivery-order-alert-title"
              >
                <motion.div
                  key={activeOrder.id}
                  initial={{ y: -120, opacity: 0, scale: 0.96 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -80, opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="w-full max-w-[400px] overflow-hidden rounded-[22px] border border-white/20 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.35)] dark:border-gray-700 dark:bg-gray-900"
                >
                  {/* Notification header strip */}
                  <div className="flex items-center gap-2.5 bg-slate-900 px-4 py-2.5 text-white">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary shadow-inner" aria-hidden>
                      <BellRing className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
                        Packnpure Delivery
                      </p>
                      <p
                        id="delivery-order-alert-title"
                        className="truncate text-sm font-black leading-tight"
                      >
                        New order request
                      </p>
                    </div>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white/90">
                      now
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="mb-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          You earn
                        </p>
                        <p className="text-3xl font-black leading-none text-emerald-600">
                          ₹{activeOrder.earnings}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-right dark:bg-emerald-950/40">
                        <p className="text-[10px] font-bold uppercase text-emerald-700/80 dark:text-emerald-300/80">
                          Respond in
                        </p>
                        <p
                          className={`text-lg font-black tabular-nums ${
                            timeLeft < 10 ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"
                          }`}
                          aria-live="polite"
                        >
                          {timeLeft}s
                        </p>
                      </div>
                    </div>

                    <div className="mb-4 space-y-3 rounded-2xl bg-slate-50 p-3 dark:bg-gray-800/80">
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100"
                          aria-hidden
                        >
                          <div className="h-2 w-2 rounded-full bg-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Pickup
                          </p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {activeOrder.pickup}
                          </p>
                        </div>
                      </div>
                      <div className="ml-3 border-l-2 border-dashed border-slate-200 pl-5 dark:border-gray-600">
                        <div className="flex items-start gap-3 -ml-[26px]">
                          <MapPin className="mt-0.5 h-6 w-6 shrink-0 text-rose-500" aria-hidden />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Drop
                            </p>
                            <p className="line-clamp-2 text-sm font-bold text-slate-900 dark:text-white">
                              {activeOrder.drop}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700"
                      aria-hidden
                    >
                      <motion.div
                        key={`${activeOrder.id}-${acceptWindowTotal}`}
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{
                          duration: Math.max(1, acceptWindowTotal || 60),
                          ease: "linear",
                        }}
                        className={timeLeft < 10 ? "h-full bg-rose-500" : "h-full bg-primary"}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={skipOrder}
                        disabled={isAcceptingOrder}
                        className="rounded-2xl bg-slate-100 py-3.5 text-xs font-black uppercase tracking-wider text-slate-700 transition-all duration-200 hover:bg-slate-200/80 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={handleAcceptOrder}
                        disabled={isAcceptingOrder}
                        autoFocus
                        className="rounded-2xl bg-primary py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-primary/30 transition-all duration-200 hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
                      >
                        {isAcceptingOrder ? "Accepting…" : "Accept"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <main
        className={`h-full min-h-screen overflow-y-auto overscroll-contain ${
          shouldShowBottomNav
            ? "pb-[calc(6rem+env(safe-area-inset-bottom,0px))]"
            : ""
        } no-scrollbar`}>
        <Outlet />
      </main>

      {shouldShowBottomNav && <BottomNav />}
    </div>
  );
};

export default DeliveryLayout;
