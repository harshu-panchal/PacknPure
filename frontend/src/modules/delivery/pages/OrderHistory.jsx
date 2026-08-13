import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Filter,
  Calendar,
  MapPin,
  Clock,
  ChevronRight,
  Zap,
  CalendarClock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import { deliveryApi } from "../services/deliveryApi";
import { toast } from "sonner";
import {
  getOrderDeliverySnapshot,
  getDeliverySubline,
} from "@/shared/utils/deliverySnapshot";

const displayOrderStatus = (order) => {
  if (order?.workflowStatus === "DELIVERED" || order?.status === "delivered")
    return "delivered";
  if (order?.workflowStatus === "CANCELLED" || order?.status === "cancelled")
    return "cancelled";
  return order?.status || "active";
};

const OrderHistory = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const prevFilterRef = useRef(filter);
  const fetchSeqRef = useRef(0);
  const visibilityAbortRef = useRef(null);

  useEffect(() => {
    visibilityAbortRef.current?.abort();
    const filterChanged = prevFilterRef.current !== filter;
    prevFilterRef.current = filter;
    if (filterChanged) {
      setOrders([]);
    }

    const abortController = new AbortController();
    const runSeq = ++fetchSeqRef.current;

    setLoading(true);
    (async () => {
      try {
        const response = await deliveryApi.getOrderHistory(
          { status: filter },
          { signal: abortController.signal },
        );
        if (runSeq !== fetchSeqRef.current) return;
        const list =
          response.data?.results ?? response.data?.result ?? [];
        setOrders(Array.isArray(list) ? list : []);
      } catch (error) {
        if (
          error?.code === "ERR_CANCELED" ||
          error?.name === "CanceledError" ||
          error?.name === "AbortError"
        ) {
          return;
        }
        if (runSeq !== fetchSeqRef.current) return;
        toast.error("Failed to fetch order history");
      } finally {
        if (runSeq === fetchSeqRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
      visibilityAbortRef.current?.abort();
    };
  }, [filter]);

  useEffect(() => {
    let sawHidden = false;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        sawHidden = true;
        return;
      }
      if (!sawHidden || document.visibilityState !== "visible") return;
      sawHidden = false;

      visibilityAbortRef.current?.abort();
      const ac = new AbortController();
      visibilityAbortRef.current = ac;
      const runSeq = ++fetchSeqRef.current;
      setLoading(true);
      (async () => {
        try {
          const response = await deliveryApi.getOrderHistory(
            { status: filter },
            { signal: ac.signal },
          );
          if (runSeq !== fetchSeqRef.current) return;
          const list =
            response.data?.results ?? response.data?.result ?? [];
          setOrders(Array.isArray(list) ? list : []);
        } catch (error) {
          if (
            error?.code === "ERR_CANCELED" ||
            error?.name === "CanceledError" ||
            error?.name === "AbortError"
          ) {
            return;
          }
          if (runSeq !== fetchSeqRef.current) return;
          toast.error("Failed to fetch order history");
        } finally {
          if (runSeq === fetchSeqRef.current) {
            setLoading(false);
          }
        }
      })();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      visibilityAbortRef.current?.abort();
    };
  }, [filter]);

  const initialLoading = loading && orders.length === 0;
  const refreshing = loading && orders.length > 0;

  const filteredOrders = (orders || []).filter((order) => {
    const q = searchQuery.toLowerCase();
    const oid = String(order.orderId ?? "");
    return (
      oid.toLowerCase().includes(q) ||
      order.customer?.name?.toLowerCase().includes(q) ||
      order.seller?.shopName?.toLowerCase().includes(q)
    );
  });

  const openOrderDetail = (order) => {
    const id = order.orderId || order._id;
    if (!id) {
      toast.error("Missing order reference");
      return;
    }
    navigate(`/delivery/order-details/${encodeURIComponent(String(id))}`);
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-900 transition-colors min-h-screen pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm p-3.5 sm:p-4 sticky top-0 z-30 backdrop-blur-md bg-white/90 dark:bg-gray-800/90">
        <h1 className="ds-h2 text-gray-900 dark:text-white mb-3 text-lg sm:text-xl font-bold">Order History</h1>

        {/* Search & Filter */}
        <div className="flex items-center space-x-2 mb-3">
          <div className="relative flex-1 min-w-0">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              size={18}
            />
            <input
              type="search"
              placeholder="Search Order ID, Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search orders"
              className="w-full pl-9 pr-3 py-2 min-h-10 bg-gray-100 dark:bg-gray-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-transparent focus:border-primary/20"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Filter orders"
            className="bg-gray-100 dark:bg-gray-700 border-transparent hover:bg-gray-200 min-h-10 min-w-10 h-10 w-10 shrink-0 focus-visible:ring-2 focus-visible:ring-primary/40">
            <Filter size={18} className="text-gray-600 dark:text-gray-300" aria-hidden />
          </Button>
        </div>

        {/* Status Filters */}
        <div className="flex space-x-2 overflow-x-auto pb-1.5 no-scrollbar scrollbar-none" role="tablist" aria-label="Order status filters">
          {["All", "Delivered", "Cancelled", "Returns"].map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={filter === status.toLowerCase()}
              onClick={() => setFilter(status.toLowerCase())}
              className={`px-3.5 py-1.5 min-h-9 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${filter === status.toLowerCase()
                ? "bg-primary text-white shadow-md shadow-primary/30 scale-105"
                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}>
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="p-3.5 sm:p-4 space-y-3.5 max-w-lg mx-auto">
        {refreshing && (
          <div className="flex items-center justify-center gap-2 py-1 text-xs font-medium text-primary">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Updating…</span>
          </div>
        )}
        {initialLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredOrders.length > 0 ? filteredOrders.map((order) => (
              <motion.div
                key={order._id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}>
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => openOrderDetail(order)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openOrderDetail(order);
                    }
                  }}
                  className="hover:shadow-md transition-shadow cursor-pointer group overflow-hidden">
                  <div className="p-3.5 sm:p-4">
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span
                            title={`#${order.orderId}`}
                            className="font-bold text-gray-900 dark:text-white text-xs xs:text-sm group-hover:text-primary transition-colors truncate max-w-[130px] min-[360px]:max-w-[170px] sm:max-w-none"
                          >
                            #{order.orderId}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${displayOrderStatus(order) === "delivered"
                              ? "bg-green-100 text-green-700"
                              : displayOrderStatus(order) === "cancelled"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                              }`}>
                            {displayOrderStatus(order)}
                          </span>
                          {(() => {
                            const snap = getOrderDeliverySnapshot(order);
                            const isSlot = snap?.deliveryMode === "SLOT";
                            return (
                              <span
                                className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                                  isSlot
                                    ? "bg-indigo-100 text-indigo-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {isSlot ? <CalendarClock size={9} /> : <Zap size={9} />}
                                {isSlot ? "SLOT" : "EXPRESS"}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="flex items-center text-gray-400 text-xs min-w-0">
                          <Calendar size={12} className="mr-1 shrink-0" />
                          <span className="truncate">
                            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {(() => {
                          const snap = getOrderDeliverySnapshot(order);
                          const line = getDeliverySubline(snap);
                          return line ? (
                            <p className="mt-1 text-[11px] font-medium text-slate-500 truncate">{line}</p>
                          ) : null;
                        })()}
                      </div>
                      <div className="text-right shrink-0 min-w-[64px]">
                        <span className="block font-bold text-base sm:text-lg text-green-600 leading-tight">
                          ₹{Math.round((order.pricing?.total || 0) * 0.1)}
                        </span>
                        <span className="ds-caption text-gray-400 text-[10px] sm:text-xs">Earnings</span>
                      </div>
                    </div>

                    <div className="border-t border-b border-gray-100 dark:border-gray-700 py-2.5 my-2.5 space-y-2">
                      <div className="flex items-start">
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 mr-2 flex-shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                        <div className="min-w-0 flex-1">
                          <p className="ds-caption text-gray-500 dark:text-gray-400 mb-0.5 text-[10px]">Store</p>
                          <p className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                            {order.seller?.shopName || "Unknown Store"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 mr-2 flex-shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                        <div className="min-w-0 flex-1">
                          <p className="ds-caption text-gray-500 dark:text-gray-400 mb-0.5 text-[10px]">
                            Customer
                          </p>
                          <p className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                            {order.customer?.name || "Customer"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 gap-2">
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="flex items-center bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-700 text-[11px]">
                          <MapPin size={11} className="mr-1 text-gray-400 shrink-0" />{" "}
                          2.4 km
                        </span>
                        <span className="flex items-center bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-700 text-[11px]">
                          <Clock size={11} className="mr-1 text-gray-400 shrink-0" /> 15 min
                        </span>
                      </div>
                      <div className="flex items-center text-primary font-bold group-hover:underline text-xs shrink-0">
                        View Details <ChevronRight size={14} className="ml-0.5 shrink-0" />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter size={32} className="text-gray-400" />
                </div>
                <h3 className="ds-h3 text-gray-900 dark:text-white">No Orders Found</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Try changing your filters.</p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
