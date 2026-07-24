import React, { useState, useMemo, useEffect } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineMagnifyingGlass,
  HiOutlineTruck,
  HiOutlinePhone,
  HiOutlineMapPin,
  HiOutlineCheckCircle,
  HiOutlineUser,
} from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";

import { sellerApi } from "../services/sellerApi";
import { useToast } from "@shared/components/ui/Toast";
import { Loader2 } from "lucide-react";
import Pagination from "@shared/components/ui/Pagination";

const DeliveryTracking = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("Active");
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchPurchaseRequests();
  }, []);

  const statusLabel = (s) => {
    const v = String(s || "").toLowerCase();
    if (v === "created") return "Awaiting Action";
    if (v === "seller_confirmed" || v === "vendor_confirmed") return "Awaiting Pickup";
    if (v === "pickup_assigned") return "Pickup Assigned";
    if (v === "picked") return "Picked Up";
    if (v === "hub_delivered") return "At Hub Gate";
    if (v === "received_at_hub") return "Received at Hub";
    if (v === "verified") return "Verified & Stocked";
    if (v === "closed") return "Closed";
    if (v === "cancelled") return "Cancelled";
    if (v === "expired") return "Expired";
    if (v === "seller_rejected") return "Rejected";
    if (v === "exception" || v === "procurement_failed") return "Exception";
    return "In Progress";
  };

  const isCompletedStatus = (s) => {
    const v = String(s || "").toLowerCase();
    return [
      "verified",
      "closed",
      "cancelled",
      "exception",
      "expired",
      "seller_rejected",
      "procurement_failed",
    ].includes(v);
  };

  const fetchPurchaseRequests = async () => {
    try {
      setLoading(true);
      const response = await sellerApi.getPurchaseRequests({ status: "all" });
      const payload = response.data?.result || response.data?.results || {};
      const prList = Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];

      const formatted = (prList || []).map((pr) => {
        const partner = pr.pickupPartner || pr.pickupPartnerId || null;
        const partnerName =
          (typeof partner === "object" && (partner?.name || partner?.fullName)) ||
          pr.pickupPartnerName ||
          "Not Assigned";
        const partnerPhone = ""; // Privacy: hide pickup partner phone from seller
        const coords =
          pr?.hubDropProof?.location || pr?.pickupProof?.location || null;

        const notes = String(pr.vendorReadyNotes || pr.notes || "").trim();
        const looksLikeInternalNote =
          /fallback request|failed pr|procurement|exception/i.test(notes);

        return {
          id: pr._id,
          orderId: pr.requestId,
          status: statusLabel(pr.status),
          rawStatus: pr.status,
          isCompleted: isCompletedStatus(pr.status),
          requestType: pr.requestType || (pr.orderId ? "automated" : "manual"),
          deliveryBoy: {
            name: partnerName,
            phone: partnerPhone,
            avatar: String(partnerName).charAt(0).toUpperCase() || "?",
            image:
              (typeof partner === "object" && partner?.image) || null,
            rating:
              typeof partner === "object" && partner?.rating
                ? Number(partner.rating)
                : null,
          },
          orderDate: pr.createdAt
            ? new Date(pr.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "",
          startTime: pr.createdAt
            ? new Date(pr.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          customerName: pr.orderId?.orderId
            ? `Order #${pr.orderId.orderId}`
            : "Hub Procurement",
          address:
            !notes || looksLikeInternalNote
              ? "Destination: PacknPure Hub"
              : notes,
          addressCoords: coords,
          productCount: Array.isArray(pr.items) ? pr.items.length : 0,
        };
      });

      setDeliveries(formatted);
    } catch (error) {
      console.error("Tracking Error:", error);
      showToast("Failed to fetch tracking data", "error");
    } finally {
      setLoading(false);
    }
  };

  const tabs = ["Active", "Completed", "All"];

  const filteredDeliveries = useMemo(() => {
    const result = deliveries.filter((dlv) => {
      const matchesSearch =
        dlv.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dlv.deliveryBoy.name.toLowerCase().includes(searchTerm.toLowerCase());

      const isCompleted = Boolean(dlv.isCompleted);
      if (activeTab === "Active") return matchesSearch && !isCompleted;
      if (activeTab === "Completed") return matchesSearch && isCompleted;
      return matchesSearch;
    });
    const totalPages = Math.max(1, Math.ceil(result.length / pageSize));
    if (page > totalPages) {
      setPage(1);
    }
    return result;
  }, [deliveries, searchTerm, activeTab, page, pageSize]);

  const paginatedDeliveries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDeliveries.slice(start, start + pageSize);
  }, [filteredDeliveries, page, pageSize]);

  const stats = useMemo(
    () => [
      {
        label: "Awaiting Pickup",
        value: deliveries.filter((d) =>
          ["created", "vendor_confirmed", "seller_confirmed"].includes(
            String(d.rawStatus || "").toLowerCase(),
          ),
        ).length,
        icon: HiOutlineTruck,
        color: "text-sky-600",
        bg: "bg-sky-50",
        ring: "ring-sky-100",
      },
      {
        label: "In Transit",
        value: deliveries.filter((d) =>
          ["pickup_assigned", "picked", "hub_delivered", "received_at_hub"].includes(
            String(d.rawStatus || "").toLowerCase(),
          ),
        ).length,
        icon: HiOutlineMapPin,
        color: "text-amber-600",
        bg: "bg-amber-50",
        ring: "ring-amber-100",
      },
      {
        label: "Verified",
        value: deliveries.filter((d) =>
          ["verified", "closed"].includes(String(d.rawStatus || "").toLowerCase()),
        ).length,
        icon: HiOutlineCheckCircle,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        ring: "ring-emerald-100",
      },
    ],
    [deliveries],
  );

  const getStatusVariant = (status) => {
    const v = String(status || "").toLowerCase();
    if (v.includes("verified") || v.includes("closed") || v.includes("stocked"))
      return "success";
    if (v.includes("cancel") || v.includes("reject") || v.includes("exception"))
      return "error";
    if (v.includes("pickup") || v.includes("transit") || v.includes("picked") || v.includes("hub"))
      return "warning";
    return "info";
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-20 md:pb-8">
      <BlurFade delay={0.05}>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex flex-wrap items-center gap-2">
            Purchase Request Tracking
            <Badge
              variant="primary"
              className="text-[9px] sm:text-[10px] px-1.5 py-0.5 font-bold tracking-wider uppercase"
            >
              Hub-First
            </Badge>
          </h1>
          <p className="text-slate-500 text-sm sm:text-base">
            Track procurement requests and pickup partner progress.
          </p>
        </div>
      </BlurFade>

      {loading ? (
        <div className="min-h-[220px] flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100">
          <Loader2 className="h-9 w-9 text-primary animate-spin" />
          <p className="text-slate-500 font-semibold mt-3 text-xs uppercase tracking-wider">
            Loading tracking…
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {stats.map((stat, i) => (
              <BlurFade key={stat.label} delay={0.05 + i * 0.04}>
                <div
                  className={cn(
                    "flex items-center gap-3 sm:gap-4 rounded-2xl bg-white p-4 ring-1 shadow-sm",
                    stat.ring,
                  )}
                >
                  <div
                    className={cn(
                      "h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0",
                      stat.bg,
                      stat.color,
                    )}
                  >
                    <stat.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide truncate">
                      {stat.label}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-none mt-1 tabular-nums">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>

          <BlurFade delay={0.15}>
            <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden rounded-2xl bg-white p-0">
              <div className="border-b border-slate-100 bg-slate-50/60 px-3 sm:px-5">
                <div className="flex flex-col gap-3 sm:gap-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
                    {tabs.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab);
                          setPage(1);
                        }}
                        className={cn(
                          "relative py-3.5 px-3 sm:px-4 text-[11px] sm:text-xs font-bold uppercase tracking-wide whitespace-nowrap rounded-t-lg transition-colors",
                          activeTab === tab
                            ? "text-primary"
                            : "text-slate-500 hover:text-slate-700",
                        )}
                      >
                        {tab}
                        {activeTab === tab && (
                          <motion.div
                            layoutId="tab-underline-tracking"
                            className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="pb-3 sm:pb-0 sm:py-2 w-full sm:w-64 md:w-72">
                    <div className="relative">
                      <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type="search"
                        placeholder="Search PR ID or partner…"
                        className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-5 space-y-3">
                <AnimatePresence mode="popLayout">
                  {paginatedDeliveries.map((dlv, idx) => (
                    <motion.div
                      key={dlv.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.2) }}
                      className="rounded-2xl border border-slate-150 bg-white overflow-hidden hover:border-slate-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col md:flex-row">
                        {/* Partner */}
                        <div className="md:w-[220px] lg:w-[240px] shrink-0 p-4 bg-slate-50/80 border-b md:border-b-0 md:border-r border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              {dlv.deliveryBoy.image ? (
                                <img
                                  src={dlv.deliveryBoy.image}
                                  alt=""
                                  className="h-12 w-12 rounded-xl object-cover ring-2 ring-white shadow-sm"
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm ring-2 ring-white shadow-sm">
                                  {dlv.deliveryBoy.avatar}
                                </div>
                              )}
                              {dlv.deliveryBoy.rating != null && dlv.deliveryBoy.rating > 0 ? (
                                <div className="absolute -bottom-1 -right-1 h-5 min-w-5 px-1 bg-emerald-500 rounded-md border-2 border-white flex items-center justify-center text-white text-[9px] font-bold">
                                  {dlv.deliveryBoy.rating}
                                </div>
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Pickup partner
                              </p>
                              <p className="text-sm font-bold text-slate-900 truncate mt-0.5">
                                {dlv.deliveryBoy.name}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <span className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
                              <HiOutlinePhone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span className="truncate">
                                {dlv.deliveryBoy.phone || "Phone hidden · Masked calling soon"}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 p-4 space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 break-all">
                                  #{dlv.orderId}
                                </span>
                                <Badge
                                  variant={
                                    dlv.requestType === "manual" ? "warning" : "primary"
                                  }
                                  className="text-[9px] uppercase font-bold px-1.5 py-0"
                                >
                                  {dlv.requestType === "manual" ? "Manual" : "Auto"}
                                </Badge>
                                <Badge
                                  variant={getStatusVariant(dlv.status)}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                                >
                                  {dlv.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                                <HiOutlineUser className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                  {dlv.customerName}
                                  {dlv.productCount > 0
                                    ? ` · ${dlv.productCount} item${dlv.productCount === 1 ? "" : "s"}`
                                    : ""}
                                </span>
                              </p>
                            </div>
                            <div className="sm:text-right shrink-0">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                Requested
                              </p>
                              <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">
                                {dlv.orderDate && dlv.startTime
                                  ? `${dlv.orderDate} · ${dlv.startTime}`
                                  : dlv.startTime || dlv.orderDate || "—"}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                                <HiOutlineMapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                                Destination
                              </p>
                              {dlv.addressCoords &&
                                typeof dlv.addressCoords.lat === "number" &&
                                typeof dlv.addressCoords.lng === "number" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const { lat, lng } = dlv.addressCoords;
                                      window.open(
                                        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
                                        "_blank",
                                        "noopener,noreferrer",
                                      );
                                    }}
                                    className="shrink-0 inline-flex items-center h-7 px-2.5 rounded-lg text-[10px] font-bold text-primary bg-white border border-primary/20 hover:bg-primary/5"
                                  >
                                    View map
                                  </button>
                                )}
                            </div>
                            <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1.5 leading-relaxed break-words">
                              {dlv.address}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {filteredDeliveries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-14 sm:py-16 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 px-4 text-center">
                    <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-3 ring-1 ring-slate-100">
                      <HiOutlineTruck className="h-7 w-7 text-slate-300" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      No shipments in this view
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      Try another tab or clear your search.
                    </p>
                  </div>
                )}
              </div>

              {filteredDeliveries.length > 0 && (
                <div className="px-3 sm:px-5 pb-4 overflow-x-auto">
                  <Pagination
                    page={page}
                    totalPages={Math.max(1, Math.ceil(filteredDeliveries.length / pageSize))}
                    total={filteredDeliveries.length}
                    pageSize={pageSize}
                    onPageChange={(newPage) => setPage(newPage)}
                    onPageSizeChange={(newSize) => {
                      setPageSize(newSize);
                      setPage(1);
                    }}
                    loading={loading}
                  />
                </div>
              )}
            </Card>
          </BlurFade>
        </>
      )}
    </div>
  );
};

export default DeliveryTracking;
