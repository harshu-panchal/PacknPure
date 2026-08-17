import React, { useState, useEffect } from "react";
import {
  Bell,
  Star,
  TrendingUp,
  Package,
  MapPin,
  CheckCircle,
  XCircle,
  IndianRupee,
  AlertCircle,
  Route,
  Store,
  Wallet,
  Banknote,
  ArrowUpRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";

import { useAuth } from "@/core/context/AuthContext";
import { deliveryApi } from "../services/deliveryApi";
import { getCurrentPositionWithCache } from "../utils/deliveryLastLocation";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [isOnline, setIsOnline] = useState(user?.isOnline || false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [reachingHub, setReachingHub] = useState(false);
  const [earnings, setEarnings] = useState({
    today: 0,
    deliveries: 0,
    incentives: 0,
    cashCollected: 0,
  });
  const [wallet, setWallet] = useState({
    earningsWallet: 0,
    cashWallet: 0,
    todayCashCollected: 0,
    cashLimit: 5000,
    cashLimitUsedPercent: 0,
    isOverCashLimit: false,
  });

  // Sync isOnline with user profile from context
  useEffect(() => {
    if (user) {
      setIsOnline(user.isOnline);
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const response = await deliveryApi.getStats();
      if (response.data.success) {
        setEarnings((prev) => ({
          ...prev,
          ...response.data.result,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch statistics:", error);
    }
  };

  const fetchWalletSummary = async () => {
    try {
      const response = await deliveryApi.getWalletSummary();
      if (response.data.success) {
        setWallet(response.data.result);
      }
    } catch (error) {
      console.error("Failed to fetch wallet summary:", error);
    }
  };

  const fetchAvailableOrders = async () => {
    try {
      const response = await deliveryApi.getAvailableOrders();
      if (response.data.success) {
        // Support both plural 'results' and singular 'result' from different backend versions
        const orders = response.data.results || response.data.result || [];
        setAvailableOrders(orders);
      }
    } catch (error) {
      console.error("Failed to fetch available orders:", error);
    }
  };

  const fetchActiveDeliveries = async () => {
    try {
      const response = await deliveryApi.getOrderHistory({ status: 'active' });
      if (response.data?.success) {
        const orders = response.data.results || response.data.result || [];
        setActiveDeliveries(orders);
      }
    } catch (error) {
      console.error("Failed to fetch active deliveries:", error);
    }
  };

  const fetchActiveTrip = async () => {
    try {
      const response = await deliveryApi.getActiveTrip();
      if (response.data?.success) {
        setActiveTrip(response.data.result?.trip || null);
      }
    } catch (error) {
      console.error("Failed to fetch active trip:", error);
    }
  };

  // One tap at the hub collects every stop in the trip together — each order
  // moves straight to "out for delivery" and its customer is notified, same
  // as the per-order flow but done once for the whole batch.
  const handleReachedHub = () => {
    if (!activeTrip?._id || reachingHub) return;
    setReachingHub(true);
    getCurrentPositionWithCache(
      async ({ lat, lng }) => {
        try {
          const res = await deliveryApi.markTripHubReached(activeTrip._id, { lat, lng });
          const { trip, partial } = res.data?.result || {};
          if (trip) setActiveTrip(trip);
          if (partial) {
            toast.error("Some orders couldn't be collected — tap Reached Hub again to retry them");
          } else {
            toast.success("All orders collected — start with stop 1");
          }
        } catch (error) {
          toast.error(error?.response?.data?.message || "Failed to mark hub as reached");
        } finally {
          setReachingHub(false);
        }
      },
      () => {
        toast.error("Location unavailable. Enable GPS/location permission and try again.");
        setReachingHub(false);
      },
      { maxCacheAgeMs: 60 * 60 * 1000 },
    );
  };

  const fetchNotifications = async () => {
    try {
      const response = await deliveryApi.getNotifications();
      if (response.data.success) {
        setUnreadCount(response.data.result?.unreadCount ?? 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchWalletSummary();
    fetchNotifications();
    if (user?.isVerified) {
      fetchAvailableOrders();
      fetchActiveDeliveries();
      fetchActiveTrip();
    }
    const interval = setInterval(() => {
      fetchNotifications();
      if (user?.isVerified) {
        fetchAvailableOrders();
        fetchActiveDeliveries();
        fetchActiveTrip();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isOnline, user?.isVerified]);

  const handleOnlineToggle = async () => {
    if (!user?.isVerified) {
      toast.error("Your account is pending admin approval.");
      return;
    }
    const newStatus = !isOnline;
    try {
      await deliveryApi.updateProfile({ isOnline: newStatus });
      await refreshUser(); // Refresh global auth state
      setIsOnline(newStatus);
      if (newStatus) {
        toast.success("You are now ONLINE. Finding orders...");
      } else {
        toast.info("You are now OFFLINE. No new orders.");
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-900 min-h-screen pb-24 relative overflow-x-hidden font-sans transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-6 pt-12 pb-4 flex justify-between items-center sticky top-0 z-30 transition-all duration-300">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            type="button"
            className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary ring-2 ring-primary/20 shadow-sm cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-transform active:scale-95"
            onClick={() => navigate("/delivery/profile")}
            aria-label="Open profile">
            <img
              src={user?.documents?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'User'}`}
              alt=""
              className="w-full h-full object-cover"
            />
          </button>
          <button
            type="button"
            onClick={() => navigate("/delivery/profile")}
            className="cursor-pointer text-left min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg">
            <h2 className="ds-h2 leading-tight dark:text-white truncate">
              {user?.name || "Delivery Partner"}
            </h2>
            <div className="flex items-center text-sm font-medium">
              <span className="flex items-center bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-100 dark:border-yellow-900/30">
                <Star size={12} fill="currentColor" className="mr-1" aria-hidden />
                {user?.rating || "New"}
              </span>
              <span className="text-gray-300 dark:text-gray-600 mx-2" aria-hidden>•</span>
              <span className="ds-caption text-gray-500 dark:text-gray-400">ID: {user?._id?.slice(-6).toUpperCase() || '-----'}</span>
            </div>
          </button>
        </div>
        <button
          type="button"
          className="relative p-2.5 min-h-11 min-w-11 bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          onClick={() => navigate("/delivery/notifications")}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}>
          <Bell
            size={20}
            className="text-gray-600 dark:text-gray-300 group-hover:text-primary transition-colors"
            aria-hidden
          />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full animate-pulse" aria-hidden></span>
          )}
        </button>
      </header>

      {/* Verification Status Banner */}
      {!user?.isVerified && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-3xl flex items-start gap-4 shadow-sm"
        >
          <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
            <AlertCircle className="text-amber-600" size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Pending Admin Approval</h4>
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              Your documents are currently under review by our operations team. You can explore the app, but you'll be able to accept orders once approved.
            </p>
          </div>
        </motion.div>
      )}

      {/* Online/Offline Toggle */}
      <div className="px-6 py-6">
        <motion.button
          type="button"
          role="switch"
          aria-checked={isOnline}
          aria-label={isOnline ? "Go offline" : "Go online"}
          onClick={handleOnlineToggle}
          className={`relative w-full h-16 rounded-full flex items-center p-1 cursor-pointer shadow-inner transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${
            isOnline
              ? "bg-green-500/10 border border-green-200 dark:border-green-900/50"
              : "bg-red-500/10 border border-red-200 dark:border-red-900/50"
          }`}
          whileTap={{ scale: 0.98 }}>
          
          {/* Background Pill */}
          <motion.div
            className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full shadow-lg border transition-colors duration-300 z-0 ${
              isOnline
                ? "bg-green-500 border-green-400"
                : "bg-red-500 border-red-400"
            }`}
            animate={{ x: isOnline ? 0 : "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            aria-hidden
          />

          {/* Texts (Rendered on top of the pill) */}
          <div
            className={`w-1/2 h-full flex items-center justify-center font-bold tracking-wide z-10 transition-all duration-300 gap-2 ${
              isOnline ? "text-white" : "text-gray-400 dark:text-gray-500 opacity-50 hover:opacity-100"
            }`}>
            {isOnline && <CheckCircle size={20} />}
            ONLINE
          </div>
          <div
            className={`w-1/2 h-full flex items-center justify-center font-bold tracking-wide z-10 transition-all duration-300 gap-2 ${
              !isOnline ? "text-white" : "text-gray-400 dark:text-gray-500 opacity-50 hover:opacity-100"
            }`}>
            {!isOnline && <XCircle size={20} />}
            OFFLINE
          </div>
        </motion.button>
      </div>

      {/* Main Content */}
      <div className="px-6 space-y-6">
        {/* Earnings Card */}
        <Card className="bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden relative transition-colors">
          {/* Background Decoration */}
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/5 dark:bg-primary/10 rounded-full blur-2xl"></div>

          <div className="flex justify-between items-center mb-4 relative z-10">
            <h3 className="ds-caption font-bold tracking-wider dark:text-gray-300">
              Today's Earnings
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/delivery/earnings")}
              className="text-primary hover:text-primary/80 hover:bg-primary/5 h-8 px-3 text-xs font-bold rounded-full">
              View Details
            </Button>
          </div>

          <div className="flex items-baseline mb-6 relative z-10">
            <span className="text-2xl font-bold text-gray-400 mr-1">₹</span>
            <span className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {earnings.today}
            </span>
            <span className="ml-3 text-green-600 dark:text-green-500 text-xs font-bold flex items-center bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 px-2 py-1 rounded-full">
              <TrendingUp size={12} className="mr-1" /> +12%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-gray-50 dark:border-gray-700 pt-4 relative z-10 transition-colors">
            <div className="text-center group cursor-pointer">
              <div className="flex justify-center mb-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors w-10 h-10 rounded-full items-center mx-auto">
                <Package size={18} />
              </div>
              <p className="ds-caption mb-0.5 dark:text-gray-400">Orders</p>
              <p className="font-bold text-gray-900 dark:text-white">{earnings.deliveries}</p>
            </div>
            <div className="text-center border-l border-r border-gray-50 dark:border-gray-700 group cursor-pointer transition-colors">
              <div className="flex justify-center mb-2 text-amber-500 bg-amber-50 dark:bg-amber-900/20 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 transition-colors w-10 h-10 rounded-full items-center mx-auto">
                <Star size={18} />
              </div>
              <p className="ds-caption mb-0.5 dark:text-gray-400">Incentives</p>
              <p className="font-bold text-gray-900 dark:text-white">₹{earnings.incentives}</p>
            </div>
            <div className="text-center group cursor-pointer">
              <div className="flex justify-center mb-2 text-green-600 bg-green-50 dark:bg-green-900/20 group-hover:bg-green-100 dark:group-hover:bg-green-900/40 transition-colors w-10 h-10 rounded-full items-center mx-auto">
                <IndianRupee size={18} />
              </div>
              <p className="ds-caption mb-0.5 dark:text-gray-400">Cash</p>
              <p className="font-bold text-gray-900 dark:text-white">
                ₹{earnings.cashCollected}
              </p>
            </div>
          </div>
        </Card>

        {/* Wallets — Earnings (yours, withdrawable) vs Cash Collection (admin's, must be remitted) */}
        <div className="grid grid-cols-2 gap-3">
          <Card
            className="bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 p-4 cursor-pointer transition-colors"
            onClick={() => navigate("/delivery/profile/withdrawals")}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                <Wallet size={16} />
              </div>
              <p className="ds-caption dark:text-gray-400">Earnings Wallet</p>
            </div>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">
              ₹{(wallet.earningsWallet || 0).toLocaleString()}
            </p>
            <p className="text-[10px] font-bold text-blue-600 flex items-center gap-1 mt-1">
              Withdraw <ArrowUpRight size={10} />
            </p>
          </Card>

          <Card
            className="bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 p-4 cursor-pointer transition-colors"
            onClick={() => navigate("/delivery/cash-remittance")}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center">
                <Banknote size={16} />
              </div>
              <p className="ds-caption dark:text-gray-400">Cash to Remit</p>
            </div>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">
              ₹{(wallet.cashWallet || 0).toLocaleString()}
            </p>
            <div className="mt-2 h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  wallet.isOverCashLimit ? "bg-rose-500" : "bg-amber-400"
                }`}
                style={{ width: `${Math.min(wallet.cashLimitUsedPercent ?? 0, 100)}%` }}
              />
            </div>
            <p className="text-[9px] font-bold text-gray-400 mt-1">
              {wallet.cashLimitUsedPercent ?? 0}% of ₹{(wallet.cashLimit || 0).toLocaleString()} limit
            </p>
          </Card>
        </div>

        {wallet.isOverCashLimit && (
          <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl px-4 py-3">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex-1">
              Cash limit reached — transfer to admin before accepting new COD orders.
            </p>
            <Button
              size="sm"
              onClick={() => navigate("/delivery/cash-remittance")}
              className="text-[10px] font-black uppercase px-3 py-1.5 h-auto rounded-full"
            >
              Transfer
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-2xl px-4 py-3 border border-gray-100 dark:border-gray-700">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Today's Cash Collected</p>
          <p className="text-sm font-extrabold text-gray-900 dark:text-white">
            ₹{(wallet.todayCashCollected || 0).toLocaleString()}
          </p>
        </div>

        {/* Current Trip — batched same-slot orders, nearest-first stops */}
        <AnimatePresence>
          {activeTrip && (() => {
            const hubReached = !!activeTrip.hubReachedAt;
            return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 border-2 border-indigo-200 dark:border-indigo-900/50 shadow-md"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-xl">
                  <Route size={18} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                    Current Trip — {activeTrip.stops?.length || 0} stops
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {hubReached
                      ? "Delivering nearest-first."
                      : "Collect everything from the hub in one go, then deliver nearest-first."}
                  </p>
                </div>
              </div>

              {!hubReached && (
                <button
                  type="button"
                  onClick={handleReachedHub}
                  disabled={reachingHub}
                  className="w-full mb-3 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider py-3.5 hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {reachingHub ? (
                    <>
                      <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Marking Collected…
                    </>
                  ) : (
                    <>
                      <Store size={14} />
                      Reached Hub — Collect All {activeTrip.stops?.length || 0} Orders
                    </>
                  )}
                </button>
              )}

              <div className="space-y-2">
                {(activeTrip.stops || [])
                  .slice()
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((stop) => {
                    const isDone = stop.status === "delivered";
                    // Nearest-first is only a suggestion once the hub is collected —
                    // any remaining stop is tappable, the rider picks the order.
                    const isSuggested = stop.sequence === activeTrip.currentStopSequence && !isDone;
                    const isSelectable = hubReached && !isDone;
                    const orderCode = stop.order?.orderId || stop.orderCode;
                    return (
                      <button
                        key={orderCode}
                        type="button"
                        disabled={!isSelectable}
                        onClick={() =>
                          isSelectable &&
                          navigate(`/delivery/order-details/${encodeURIComponent(orderCode)}`)
                        }
                        className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                          isDone
                            ? "bg-emerald-50 dark:bg-emerald-900/10 opacity-70"
                            : isSuggested
                              ? "bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-200 dark:ring-indigo-800 cursor-pointer"
                              : isSelectable
                                ? "bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40"
                                : "bg-gray-50 dark:bg-gray-900/30 opacity-60"
                        }`}
                      >
                        <span
                          className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                            isDone
                              ? "bg-emerald-500 text-white"
                              : isSuggested
                                ? "bg-indigo-600 text-white"
                                : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                          }`}
                        >
                          {isDone ? <CheckCircle size={13} /> : stop.sequence}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-gray-900 dark:text-white truncate">
                            #{orderCode} — {stop.order?.customer?.name || "Customer"}
                          </span>
                          <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {stop.order?.address?.address || stop.order?.address?.city || ""}
                          </span>
                        </span>
                        {isDone ? (
                          <span className="shrink-0 text-[10px] font-black text-emerald-600 uppercase">
                            Delivered
                          </span>
                        ) : isSuggested ? (
                          <span className="shrink-0 text-[10px] font-black text-indigo-600 uppercase">
                            Nearest • Go
                          </span>
                        ) : (
                          isSelectable && (
                            <span className="shrink-0 text-[10px] font-black text-gray-400 uppercase">
                              Go
                            </span>
                          )
                        )}
                      </button>
                    );
                  })}
              </div>
            </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Active Deliveries Banner */}
        <AnimatePresence>
          {activeDeliveries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200 relative overflow-hidden cursor-pointer"
              onClick={() => navigate("/delivery/history")}
            >
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-white dark:bg-gray-800/10 rounded-full blur-xl"></div>
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="bg-white dark:bg-gray-800/20 p-3 rounded-xl">
                    <Package size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight">Active Deliveries</h3>
                    <p className="text-emerald-100 text-xs font-medium">
                      You have {activeDeliveries.length} active delivery task(s).
                    </p>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider">
                  View Tasks
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Order / Status */}
        <AnimatePresence mode="wait">
          {isOnline ? (
            availableOrders.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 border-2 border-primary/25 shadow-md shadow-primary/5 text-center transition-colors">
                <div className="flex justify-center mb-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Package className="text-primary" size={24} />
                  </div>
                </div>
                <h3 className="ds-h3 text-gray-900 dark:text-white mb-1">
                  {availableOrders.length === 1
                    ? "1 order waiting"
                    : `${availableOrders.length} orders waiting`}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed px-1">
                  A fullscreen alert will open with <strong className="dark:text-white">Accept</strong> and{" "}
                  <strong className="dark:text-white">Reject</strong>. Use that to respond before the timer
                  ends.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Listening for assignments
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="searching"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 relative overflow-hidden transition-colors">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/50 dark:from-blue-900/10 to-purple-50/50 dark:to-purple-900/10 opacity-50 transition-colors"></div>
                <div className="relative z-10">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/40 rounded-full animate-ping opacity-20 transition-colors"></div>
                    <div className="absolute inset-2 bg-blue-100 dark:bg-blue-900/40 rounded-full animate-ping opacity-40 delay-150 transition-colors"></div>
                    <div className="relative w-full h-full bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center border border-blue-100 dark:border-blue-900/30 shadow-sm transition-colors">
                      <MapPin size={36} className="text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <h3 className="ds-h3 mb-2 text-gray-800 dark:text-gray-100">
                    {activeDeliveries.length > 0 ? "You have active tasks." : "Finding Orders Nearby..."}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[220px] mx-auto mb-6">
                    {activeDeliveries.length > 0 ? "Please complete your active assignments." : "We're looking for delivery requests in your area. Stay online!"}
                  </p>
                </div>
              </motion.div>
            )
          ) : (
              <motion.div
              key="offline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-900 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-100 dark:border-gray-700 dark:border-gray-600 transition-colors">
                <AlertCircle size={32} className="text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="ds-h3 mb-2 dark:text-white">You are Offline</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[250px] mx-auto">
                Go online to start receiving delivery requests and earning
                money.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Dashboard;
