import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import InvoiceModal from "../components/order/InvoiceModal";
import HelpModal from "../components/order/HelpModal";
import LiveTrackingMap from "../components/order/LiveTrackingMap";
import DeliveryOtpDisplay from "../components/DeliveryOtpDisplay";
import OrderProgressTracker from "../components/order/OrderProgressTracker";
import OrderItemRow from "../components/order/OrderItemRow";
import {
  ChevronLeft,
  Package,
  Truck,
  MapPin,
  CreditCard,
  Download,
  HelpCircle,
  Phone,
  Loader2,
  Store,
  Navigation2,
  PackageX,
} from "lucide-react";
import { customerApi } from "../services/customerApi";
import { toast } from "sonner";
import { subscribeToOrderLocation, subscribeToOrderTrail, subscribeToOrderRoute } from "@/core/services/trackingClient";
import {
  getOrderSocket,
  joinOrderRoom,
  leaveOrderRoom,
  onOrderStatusUpdate,
  onCustomerOtp,
} from "@/core/services/orderSocket";
import { getLegacyStatusFromOrder, getOrderStatusLabel } from "@/shared/utils/orderStatus";
import { resolveOrderItemVariantLabel } from "@/shared/utils/orderItemDisplay";
import { cn } from "@/lib/utils";

const ACCENT = "#E23744";

const coordsToLatLng = (coords) => {
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
};

const hasValidLatLng = (location) =>
  location &&
  typeof location.lat === "number" &&
  typeof location.lng === "number" &&
  Number.isFinite(location.lat) &&
  Number.isFinite(location.lng);

const DEFAULT_CITY_SPEED_KMPH = 24;
const ROUTE_REFRESH_THRESHOLD_M = 150;
const ROUTE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const toRadians = (value) => (value * Math.PI) / 180;

const distanceMeters = (from, to) => {
  if (!hasValidLatLng(from) || !hasValidLatLng(to)) return null;
  const r = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatArrivalTime = (arrivalMs) =>
  new Date(arrivalMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

const formatArrivingIn = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 0) return "Soon";
  const rounded = Math.max(1, Math.round(minutes));
  return `${rounded} min${rounded === 1 ? "" : "s"}`;
};

const formatDistance = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  if (meters < 1000) {
    return `${Math.max(50, Math.round(meters / 10) * 10)} m`;
  }
  return `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`;
};

const estimateMinutesFromDistance = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return null;
  return (meters * 60) / (DEFAULT_CITY_SPEED_KMPH * 1000);
};

const getTrackingRoutePhase = (order) => {
  if (!order) return "pickup";

  const workflowStatus = String(order.workflowStatus || "").toUpperCase();
  const legacyStatus = String(order.status || "").toLowerCase();
  const riderStep = Number(order.deliveryRiderStep) || 0;

  const isDeliveryPhase =
    workflowStatus === "OUT_FOR_DELIVERY" ||
    workflowStatus === "DELIVERED" ||
    legacyStatus === "out_for_delivery" ||
    legacyStatus === "delivered" ||
    riderStep >= 3 ||
    Boolean(order.pickupConfirmedAt);

  return isDeliveryPhase ? "delivery" : "pickup";
};

function formatInr(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatPaymentMethod(method) {
  const m = String(method || "").toLowerCase();
  if (m === "cash") return "Cash on delivery";
  if (m === "wallet") return "Wallet";
  if (m === "online") return "Paid online";
  return method || "—";
}

function detailStatusMeta(legacy) {
  switch (legacy) {
    case "delivered":
      return { pill: "bg-emerald-50 text-emerald-700 ring-emerald-100" };
    case "cancelled":
      return { pill: "bg-slate-100 text-slate-600 ring-slate-200" };
    case "out_for_delivery":
      return { pill: "bg-violet-50 text-violet-700 ring-violet-100" };
    case "confirmed":
    case "packed":
      return { pill: "bg-blue-50 text-blue-700 ring-blue-100" };
    default:
      return { pill: "bg-amber-50 text-amber-700 ring-amber-100" };
  }
}

function OrderDetailHeader({ order, statusLabel, statusPill }) {
  return (
    <div className="sticky top-0 z-30 border-b border-slate-200/60 bg-slate-50/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 pb-3 pt-4">
        <Link
          to="/orders"
          className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-200/70"
          aria-label="Back to orders"
        >
          <ChevronLeft size={22} className="text-slate-800" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-slate-900">Order details</h1>
          <p className="truncate text-[11px] font-medium text-slate-500">
            #{String(order.orderId).slice(-10)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1",
            statusPill,
          )}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

const OrderDetailPage = () => {
  const { orderId } = useParams();
  const [showInvoice, setShowInvoice] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returnDetails, setReturnDetails] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [requestingReturn, setRequestingReturn] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selectedReturnItems, setSelectedReturnItems] = useState({});
  const [returnReason, setReturnReason] = useState("");
  const [returnImages, setReturnImages] = useState([]);
  const [liveLocation, setLiveLocation] = useState(null);
  const [trail, setTrail] = useState([]);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [handoffOtp, setHandoffOtp] = useState(null);
  const [clockTick, setClockTick] = useState(Date.now());
  const routeRequestRef = useRef({ phase: null, startedAt: 0 });
  const routeOriginRef = useRef(null);

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await customerApi.getOrderDetails(orderId);
        const ord = response.data.result;
        setOrder(ord);

        try {
          const retRes = await customerApi.getReturnDetails(orderId);
          setReturnDetails(retRes.data.result);
        } catch {
          setReturnDetails(null);
        }
      } catch (error) {
        console.error("Failed to fetch order details:", error);
        toast.error("Failed to load order details");
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return undefined;
    const iv = setInterval(() => {
      customerApi
        .getOrderDetails(orderId)
        .then((r) => setOrder(r.data.result))
        .catch(() => {});
    }, 12000);
    return () => clearInterval(iv);
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return undefined;
    const getToken = () => localStorage.getItem("auth_customer");
    getOrderSocket(getToken);
    joinOrderRoom(orderId, getToken);
    const offStatus = onOrderStatusUpdate(getToken, () => {
      customerApi
        .getOrderDetails(orderId)
        .then((r) => setOrder(r.data.result))
        .catch(() => {});
    });
    const offOtp = onCustomerOtp(getToken, (payload) => {
      if (payload?.orderId === orderId && payload?.code) {
        setHandoffOtp(payload.code);
        toast.info("Delivery OTP received — share with rider if asked.");
      }
    });
    return () => {
      offStatus();
      offOtp();
      leaveOrderRoom(orderId, getToken);
    };
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    const offLocation = subscribeToOrderLocation(orderId, setLiveLocation);
    const offTrail = subscribeToOrderTrail(orderId, setTrail);
    const offRoute = subscribeToOrderRoute(orderId, setRoutePolyline);

    return () => {
      offLocation?.();
      offTrail?.();
      offRoute?.();
    };
  }, [orderId]);

  useEffect(() => {
    const iv = setInterval(() => setClockTick(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);

  const handleOpenInMaps = () => {
    const loc = order?.address?.location;
    const dest =
      loc &&
      typeof loc.lat === "number" &&
      typeof loc.lng === "number" &&
      Number.isFinite(loc.lat) &&
      Number.isFinite(loc.lng)
        ? loc
        : null;

    const rider =
      liveLocation &&
      typeof liveLocation.lat === "number" &&
      typeof liveLocation.lng === "number"
        ? liveLocation
        : null;

    if (rider && dest) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&origin=${rider.lat},${rider.lng}&destination=${dest.lat},${dest.lng}`,
        "_blank",
      );
      return;
    }

    if (dest) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`,
        "_blank",
      );
      return;
    }

    window.open("https://maps.google.com", "_blank");
  };

  const status = order ? getLegacyStatusFromOrder(order) : null;
  const sellerLocation = coordsToLatLng(order?.seller?.location?.coordinates);
  const routePhase = getTrackingRoutePhase(order);
  const routeMatchesPhase =
    routePhase === "pickup"
      ? routePolyline?.phase
        ? routePolyline.phase === routePhase
        : !!routePolyline?.polyline
      : routePolyline?.phase === routePhase;
  const activeRoutePolyline = routeMatchesPhase ? routePolyline : null;
  const estimatedArrival = useMemo(() => {
    if (!order) {
      return {
        arrivalTimeText: "--",
        arrivingInText: "--",
      };
    }

    if (status === "delivered") {
      return {
        arrivalTimeText: "Arrived",
        arrivingInText: "Delivered",
      };
    }

    const targetLocation =
      routePhase === "delivery" ? order?.address?.location : sellerLocation;

    let minutes = null;
    const routeDurationSeconds = Number(activeRoutePolyline?.duration);
    if (Number.isFinite(routeDurationSeconds) && routeDurationSeconds > 0) {
      minutes = routeDurationSeconds / 60;
    } else {
      const routeDistanceMeters = Number(activeRoutePolyline?.distanceMeters);
      minutes =
        estimateMinutesFromDistance(routeDistanceMeters) ??
        estimateMinutesFromDistance(distanceMeters(liveLocation, targetLocation));
    }

    if (!Number.isFinite(minutes) || minutes <= 0) {
      minutes = status === "confirmed" ? 12 : 8;
    }

    const arrivalMs = clockTick + minutes * 60 * 1000;
    const routeDistanceMeters = Number(
      activeRoutePolyline?.distanceMeters ?? activeRoutePolyline?.distance,
    );
    return {
      arrivalTimeText: formatArrivalTime(arrivalMs),
      arrivingInText: formatArrivingIn(minutes),
      totalDistanceText: formatDistance(
        routeDistanceMeters ||
          distanceMeters(liveLocation, targetLocation),
      ),
    };
  }, [
    activeRoutePolyline?.distanceMeters,
    activeRoutePolyline?.duration,
    liveLocation,
    order,
    routePhase,
    sellerLocation,
    status,
    clockTick,
  ]);

  useEffect(() => {
    if (!orderId || status === "delivered" || status === "cancelled") return;
    if (!hasValidLatLng(liveLocation)) return;

    const currentOrigin = {
      lat: liveLocation.lat,
      lng: liveLocation.lng,
    };
    const originDrift =
      routeOriginRef.current && hasValidLatLng(routeOriginRef.current)
        ? distanceMeters(routeOriginRef.current, currentOrigin)
        : null;
    const routeIsFresh =
      activeRoutePolyline?.polyline &&
      originDrift !== null &&
      originDrift < ROUTE_REFRESH_THRESHOLD_M &&
      routePhase === activeRoutePolyline?.phase;

    if (routeIsFresh) return;

    const now = Date.now();
    if (
      routeRequestRef.current.phase === routePhase &&
      now - routeRequestRef.current.startedAt < ROUTE_REFRESH_INTERVAL_MS &&
      (originDrift === null || originDrift < ROUTE_REFRESH_THRESHOLD_M)
    ) {
      return;
    }

    routeRequestRef.current = { phase: routePhase, startedAt: now };
    let ignore = false;

    customerApi
      .getOrderRoute(orderId, {
        phase: routePhase,
        originLat: liveLocation.lat,
        originLng: liveLocation.lng,
        _t: now,
      })
      .then((response) => {
        if (ignore) return;
        const nextRoute = response.data?.result;
        if (nextRoute?.polyline) {
          setRoutePolyline(nextRoute);
          routeOriginRef.current = currentOrigin;
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [
    activeRoutePolyline?.polyline,
    liveLocation,
    orderId,
    routePhase,
    status,
  ]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Loader2 className="animate-spin text-[#E23744]" size={22} />
          <span className="text-sm font-medium text-slate-600">Loading order…</span>
        </div>
      </div>
    );
  }

  const canRequestReturn = () => {
    if (!order) return false;
    if (getLegacyStatusFromOrder(order) !== "delivered") return false;
    if (
      returnDetails &&
      returnDetails.returnStatus &&
      returnDetails.returnStatus !== "none" &&
      returnDetails.returnStatus !== null
    ) {
      return false;
    }
    return true;
  };

  const canCancelOrder = () => {
    if (!order) return false;
    const wf = String(order.workflowStatus || "").toUpperCase();
    return wf === "CREATED" || wf === "SELLER_PENDING";
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    try {
      setCancelling(true);
      await customerApi.cancelOrder(order.orderId, { reason: "Cancelled by customer" });
      toast.success("Order cancelled successfully");
      setShowCancelModal(false);
      const res = await customerApi.getOrderDetails(orderId);
      setOrder(res.data.result);
    } catch (error) {
      console.error("Failed to cancel order", error);
      toast.error(error.response?.data?.message || "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  const toggleItemSelection = (index) => {
    setSelectedReturnItems((prev) => {
      const next = { ...prev };
      if (next[index]) {
        delete next[index];
      } else {
        next[index] = { quantity: order.items[index].quantity };
      }
      return next;
    });
  };

  const handleReturnSubmit = async () => {
    if (!order) return;
    if (!Object.keys(selectedReturnItems).length) {
      toast.error("Please select at least one item to return.");
      return;
    }
    if (!returnReason.trim()) {
      toast.error("Please provide a reason for return.");
      return;
    }

    const payload = {
      items: Object.entries(selectedReturnItems).map(([idx, val]) => ({
        itemIndex: Number(idx),
        quantity: val.quantity,
      })),
      reason: returnReason,
      images: returnImages,
    };

    try {
      setRequestingReturn(true);
      await customerApi.requestReturn(order.orderId, payload);
      toast.success("Return request submitted");
      setShowReturnModal(false);
      setSelectedReturnItems({});
      setReturnReason("");
      setReturnImages([]);

      const [orderRes, retRes] = await Promise.all([
        customerApi.getOrderDetails(orderId),
        customerApi.getReturnDetails(orderId),
      ]);
      setOrder(orderRes.data.result);
      setReturnDetails(retRes.data.result);
    } catch (error) {
      console.error("Failed to submit return request", error);
      toast.error(
        error.response?.data?.message || "Failed to submit return request",
      );
    } finally {
      setRequestingReturn(false);
    }
  };

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <Package size={56} className="mb-4 text-slate-300" />
        <h3 className="text-lg font-bold text-slate-800">Order not found</h3>
        <p className="mt-1 text-sm text-slate-500">This order may have been removed or is unavailable.</p>
        <Link
          to="/orders"
          className="mt-6 rounded-xl px-6 py-2.5 text-sm font-bold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          Back to orders
        </Link>
      </div>
    );
  }

  const statusLabel = getOrderStatusLabel(order);
  const statusPill = detailStatusMeta(status).pill;
  const orderDate = new Date(order.createdAt);
  const placedOn = orderDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const placedTime = orderDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const sellerName =
    order.seller?.shopName || order.seller?.name || null;
  const sellerAddress = order.seller?.address || null;
  const isActive = status !== "delivered" && status !== "cancelled";

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      <OrderDetailHeader
        order={order}
        statusLabel={statusLabel}
        statusPill={statusPill}
      />

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4 md:py-6">
        {/* Order meta strip */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Placed on
              </p>
              <p className="text-sm font-bold text-slate-900">
                {placedOn} · {placedTime}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Order total
              </p>
              <p className="text-lg font-black text-slate-900">
                {formatInr(order.pricing?.total)}
              </p>
            </div>
          </div>
          {isActive && (
            <div
              className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 text-white"
              style={{ backgroundColor: ACCENT }}
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
                  Arriving in
                </p>
                <p className="text-xl font-black">{estimatedArrival.arrivingInText}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold text-white/80">ETA</p>
                <p className="text-sm font-bold">{estimatedArrival.arrivalTimeText}</p>
              </div>
            </div>
          )}
          {status === "delivered" && (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-700">
              Order delivered successfully
            </p>
          )}
          {status === "cancelled" && (
            <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-600">
              This order was cancelled
            </p>
          )}
        </div>

        {isActive && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <LiveTrackingMap
              status={order.workflowStatus || order.status}
              eta={estimatedArrival.arrivingInText}
              riderName={order.deliveryBoy?.name || "Delivery Partner"}
              riderLocation={liveLocation}
              sellerLocation={sellerLocation}
              destinationLocation={order.address?.location || null}
              routePhase={routePhase}
              routePolyline={activeRoutePolyline}
              onOpenInMaps={handleOpenInMaps}
            />
          </div>
        )}

        <OrderProgressTracker
          order={order}
          estimatedArrivalText={estimatedArrival.arrivalTimeText}
          arrivingInText={estimatedArrival.arrivingInText}
          totalDistanceText={estimatedArrival.totalDistanceText}
        />

        <DeliveryOtpDisplay orderId={orderId} />

        {order.deliveryBoy && isActive && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: ACCENT }}
              >
                <Truck size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Delivery partner
                </p>
                <p className="truncate text-base font-bold text-slate-900">
                  {order.deliveryBoy.name || "Assigned rider"}
                </p>
                {order.deliveryBoy.phone ? (
                  <a
                    href={`tel:${order.deliveryBoy.phone}`}
                    className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-[#E23744]"
                  >
                    <Phone size={14} />
                    {order.deliveryBoy.phone}
                  </a>
                ) : null}
              </div>
              {order.deliveryBoy.phone ? (
                <a
                  href={`tel:${order.deliveryBoy.phone}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100"
                  aria-label="Call delivery partner"
                >
                  <Phone size={18} className="text-slate-700" />
                </a>
              ) : null}
            </div>
          </div>
        )}

        {/* Address & seller */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <MapPin size={20} className="text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Deliver to
                  </p>
                  {order.address?.type ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      {order.address.type}
                    </span>
                  ) : null}
                </div>
                <p className="font-bold text-slate-900">{order.address?.name || "Customer"}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {[order.address?.address, order.address?.city, order.address?.landmark]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {order.address?.phone ? (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <Phone size={14} className="text-slate-400" />
                    {order.address.phone}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleOpenInMaps}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
                aria-label="Open in maps"
              >
                <Navigation2 size={18} className="text-slate-700" />
              </button>
            </div>
          </div>

          {sellerName && (
            <div className="border-b border-slate-100 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                  <Store size={20} className="text-amber-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Fulfilled by
                  </p>
                  <p className="font-bold text-slate-900">{sellerName}</p>
                  {sellerAddress ? (
                    <p className="mt-1 text-sm text-slate-600">{sellerAddress}</p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Package size={16} className="text-slate-400" />
              Items ({order.items?.length || 0})
            </h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {(order.items || []).map((item, idx) => (
              <OrderItemRow key={idx} item={item} />
            ))}
          </ul>
        </div>

        {/* Bill */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">Bill summary</h3>
          </div>
          <div className="space-y-2.5 px-4 py-4 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Item total</span>
              <span className="font-semibold text-slate-900">
                {formatInr(order.pricing?.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery fee</span>
              <span
                className={cn(
                  "font-semibold",
                  Number(order.pricing?.deliveryFee) === 0 ? "text-emerald-600" : "text-slate-900",
                )}
              >
                {Number(order.pricing?.deliveryFee) === 0
                  ? "FREE"
                  : formatInr(order.pricing?.deliveryFee)}
              </span>
            </div>
            {Number(order.pricing?.gst) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>GST</span>
                <span className="font-semibold text-slate-900">{formatInr(order.pricing?.gst)}</span>
              </div>
            )}
            {Number(order.pricing?.tip) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tip</span>
                <span className="font-semibold text-slate-900">{formatInr(order.pricing?.tip)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="font-bold text-slate-900">Total paid</span>
              <span className="text-xl font-black" style={{ color: ACCENT }}>
                {formatInr(order.pricing?.total)}
              </span>
            </div>
          </div>
          <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
              <CreditCard size={18} className="text-slate-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Payment
              </p>
              <p className="text-sm font-bold text-slate-900">
                {formatPaymentMethod(order.payment?.method)}
              </p>
            </div>
          </div>
        </div>

        <div className={cn("grid gap-3", canCancelOrder() ? "grid-cols-3" : "grid-cols-2")}>
          <button
            type="button"
            onClick={() => setShowInvoice(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Invoice</span>
          </button>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <HelpCircle size={18} />
            <span className="hidden sm:inline">Help</span>
          </button>
          {canCancelOrder() && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-bold text-rose-700 shadow-sm hover:bg-rose-100"
            >
              Cancel
            </button>
          )}
        </div>

        {(canRequestReturn() ||
          (returnDetails?.returnStatus && returnDetails.returnStatus !== "none")) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Return & refund</h3>
            {returnDetails?.returnStatus && returnDetails.returnStatus !== "none" ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-semibold text-slate-700">
                  Status:{" "}
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase text-slate-800">
                    {returnDetails.returnStatus.replace(/_/g, " ")}
                  </span>
                </p>
                {returnDetails.returnStatus === "return_rejected" && (
                  <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                    {returnDetails.returnRejectedReason || "Return request was rejected."}
                  </p>
                )}
                {returnDetails.returnRefundAmount > 0 &&
                  returnDetails.returnStatus === "refund_completed" && (
                    <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                      {formatInr(returnDetails.returnRefundAmount)} credited to your wallet.
                    </p>
                  )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No return requested for this order.</p>
            )}
            {canRequestReturn() && (
              <button
                type="button"
                onClick={() => setShowReturnModal(true)}
                className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                Request return
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <InvoiceModal
        isOpen={showInvoice}
        onClose={() => setShowInvoice(false)}
        order={order}
      />
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !cancelling && setShowCancelModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 text-center"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 mb-4">
              <PackageX size={28} className="text-rose-600" />
            </div>
            <h3 className="text-xl font-black text-slate-900">
              Cancel this order?
            </h3>
            <p className="text-sm text-slate-500">
              Are you sure you want to cancel this order? This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => !cancelling && setShowCancelModal(false)}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                disabled={cancelling}
              >
                No, keep it
              </button>
              <button
                onClick={handleCancelOrder}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-70 transition-colors flex justify-center items-center gap-2"
                disabled={cancelling}
              >
                {cancelling && <Loader2 size={16} className="animate-spin" />}
                Yes, cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Return Request Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !requestingReturn && setShowReturnModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4"
          >
            <h3 className="text-lg font-black text-slate-900">
              Request Return
            </h3>
            <p className="text-xs text-slate-500">
              Select the items you want to return and tell us why.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-3">
              {order.items.map((item, idx) => {
                const checked = !!selectedReturnItems[idx];
                const variantLabel = resolveOrderItemVariantLabel(item);
                return (
                  <label
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItemSelection(idx)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Qty: {item.quantity}
                        {variantLabel ? ` · ${variantLabel}` : ""}
                        {" · "}
                        ₹{item.price * item.quantity}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600">
                Reason for return
              </label>
              <textarea
                rows={3}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="Describe the issue with the product..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => !requestingReturn && setShowReturnModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                disabled={requestingReturn}>
                Cancel
              </button>
              <button
                onClick={handleReturnSubmit}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-70 transition-all"
                disabled={requestingReturn}>
                {requestingReturn ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailPage;
