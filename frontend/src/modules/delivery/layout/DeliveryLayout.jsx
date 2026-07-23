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
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audio.play().catch(() => {});
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
    setActiveOrder({
      id: newOrder.orderId,
      mongoId: newOrder._id,
      pickup: pickupLabel,
      drop: newOrder.address?.address || "Customer Address",
      distance: "Nearby",
      estTime: "10-15 min",
      value: total,
      earnings: Math.max(newOrder.pricing?.deliveryFee ?? 0, 25), // Ensure minimum ₹25 earning even if delivery is free
      expiresAt: newOrder.deliverySearchExpiresAt || null,
    });
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audio.play().catch(() => {});
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
    try {
      const idem =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`;
      await deliveryApi.acceptOrder(activeOrder.id, idem);
      toast.success("Order accepted!");
      const orderId = activeOrder.id;
      shownOrderIdsRef.current = new Set(shownOrderIdsRef.current).add(orderId);
      markIncomingOrderHandled(orderId);
      setActiveOrder(null);
      navigate(`/delivery/order-details/${orderId}`);
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        (typeof error.response?.data === "string" ? error.response.data : null);
      toast.error(msg || "Failed to accept order");
      setActiveOrder(null);
    } finally {
      acceptInFlightRef.current = false;
      setIsAcceptingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans max-w-md mx-auto relative shadow-2xl overflow-x-hidden border-x border-gray-100 dark:border-gray-800 transition-colors">
      {/* Full-screen order alert — portaled so it always stacks above nav/content */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {activeOrder && (
              <motion.div
                key={`overlay-${activeOrder.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/85 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delivery-order-alert-title"
              >
                <motion.div
                  key={activeOrder.id}
                  initial={{ scale: 0.92, opacity: 0, y: 24 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.96, opacity: 0, y: 16 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="bg-white dark:bg-gray-800 rounded-[32px] p-6 w-full max-w-[340px] shadow-2xl border-4 border-primary/20 max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex flex-col items-center">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 animate-bounce" aria-hidden>
                      <BellRing className="h-8 w-8 text-primary" />
                    </div>

                    <h2
                      id="delivery-order-alert-title"
                      className="text-xl font-black text-slate-900 dark:text-white mb-1"
                    >
                      New order request
                    </h2>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                      Accept or reject
                    </p>
                    <div className="flex items-center gap-2 mb-6">
                      <span className="text-2xl font-black text-green-600">₹{activeOrder.earnings}</span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-outfit">
                        Earnings
                      </span>
                    </div>

                    <div className="w-full space-y-4 mb-6">
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-1" aria-hidden>
                          <div className="w-2 h-2 rounded-full bg-green-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Pickup</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{activeOrder.pickup}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-rose-500 mt-1 shrink-0" aria-hidden />
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Drop</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{activeOrder.drop}</p>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-1.5 bg-slate-100 dark:bg-gray-700 rounded-full mb-2 overflow-hidden" aria-hidden>
                      <motion.div
                        key={`${activeOrder.id}-${acceptWindowTotal}`}
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{
                          duration: Math.max(1, acceptWindowTotal || 60),
                          ease: "linear",
                        }}
                        className={timeLeft < 10 ? "bg-rose-500 h-full" : "bg-primary h-full"}
                      />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mb-4 w-full text-center" aria-live="polite">
                      {timeLeft}s left to respond
                    </p>

                    <div className="grid grid-cols-2 gap-4 w-full">
                      <button
                        type="button"
                        onClick={skipOrder}
                        disabled={isAcceptingOrder}
                        className="py-4 rounded-2xl bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200 font-black text-xs uppercase tracking-wider hover:bg-slate-200/80 dark:hover:bg-gray-600 active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 disabled:pointer-events-none cursor-pointer disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={handleAcceptOrder}
                        disabled={isAcceptingOrder}
                        autoFocus
                        className="py-4 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-primary/30 hover:brightness-105 active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none cursor-pointer disabled:cursor-not-allowed"
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
