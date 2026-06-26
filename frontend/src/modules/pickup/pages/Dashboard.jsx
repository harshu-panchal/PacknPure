import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@core/context/AuthContext";
import { toast } from "sonner";
import { pickupApi } from "../services/pickupApi";
import { 
  Package, 
  MapPin, 
  CheckCircle, 
  Truck, 
  LogOut, 
  RefreshCw, 
  Clock, 
  Store,
  ChevronRight,
  Navigation,
  KeyRound
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PurchaseRequestTimeline from "@shared/components/PurchaseRequestTimeline";
import { formatPrDate } from "@shared/utils/purchaseRequestFormat";

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });

const toLatLng = (loc) => {
  const coords = loc?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
};

const openDirections = (destination) => {
  if (!destination) return;
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`,
    "_blank",
  );
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [statusFilter, setStatusFilter] = useState("active");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [otpById, setOtpById] = useState({});
  const [notesById, setNotesById] = useState({});
  const [vendorImageById, setVendorImageById] = useState({});
  const [hubImageById, setHubImageById] = useState({});
  const [pickedQtyById, setPickedQtyById] = useState({});
  const [uploadingId, setUploadingId] = useState("");
  const [profile, setProfile] = useState(null);

  const fetchProfile = async () => {
    try {
      const res = await pickupApi.getMyProfile();
      if (res?.data?.success) setProfile(res.data.result);
    } catch (e) { console.error(e); }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      fetchProfile();
      const res = await pickupApi.getAssignments({ status: statusFilter });
      const items = res?.data?.result?.items || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load assignments");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
    const timer = setInterval(() => {
      fetchAssignments();
    }, 15000);
    return () => clearInterval(timer);
  }, [statusFilter]);

  useEffect(() => {
    setOtpById((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!next[row._id] && row.pickupOtp) {
          next[row._id] = String(row.pickupOtp);
        }
      }
      return next;
    });
    setPickedQtyById((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (row.status === "pickup_assigned" && !next[row._id]) {
          next[row._id] = {};
          for (const p of row.products || []) {
            next[row._id][p.productId] = p.qty;
          }
        }
      }
      return next;
    });
  }, [rows]);

  const stats = useMemo(() => {
    const assigned = rows.filter((r) => r.status === "pickup_assigned").length;
    const picked = rows.filter((r) => r.status === "picked").length;
    const delivered = rows.filter((r) => r.status === "hub_delivered").length;
    return [
      { label: "Assigned", value: assigned, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
      { label: "Picked", value: picked, icon: Package, color: "text-sky-600", bg: "bg-sky-50" },
      { label: "Done", value: delivered, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Earnings", value: `₹${Number(profile?.walletBalance || user?.walletBalance || 0).toFixed(0)}`, icon: Navigation, color: "text-indigo-600", bg: "bg-indigo-50" },
    ];
  }, [rows, profile, user]);

  const onMarkPicked = async (row) => {
    const otp = String(otpById[row._id] || "").trim();
    if (!otp) {
      toast.error("Please enter the Pickup OTP");
      return;
    }

    try {
      setActionLoadingId(row._id);
      const coords = await getCurrentPosition();
      const items = Object.entries(pickedQtyById[row._id] || {}).map(([productId, actualPickedQty]) => ({
        productId,
        actualPickedQty: Number(actualPickedQty),
      }));
      await pickupApi.markPicked(row._id, {
        otp,
        lat: coords.latitude,
        lng: coords.longitude,
        notes: notesById[row._id] || "",
        vendorImageUrl: vendorImageById[row._id] || "",
        items,
      });
      toast.success(`Items picked successfully from ${row.vendor?.shopName || "Vendor"}`);
      await fetchAssignments();
    } catch (error) {
      const msg = error?.response?.data?.message || "Verification failed";
      toast.error(msg, {
        description: msg.includes("far") ? "Please ensure you are at the vendor's shop location." : ""
      });
    } finally {
      setActionLoadingId("");
    }
  };

  const onCancelPickup = async (row) => {
    const reason = window.prompt("Reason for cancellation?");
    if (!reason) return;
    try {
      setActionLoadingId(row._id);
      await pickupApi.cancelPickupAssignment(row._id, { notes: reason });
      toast.success("Assignment cancelled successfully");
      await fetchAssignments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Cancellation failed");
    } finally {
      setActionLoadingId("");
    }
  };

  const onMarkReturnDelivered = async (row) => {
    try {
      setActionLoadingId(row._id);
      await pickupApi.markReturnDelivered(row._id, { notes: notesById[row._id] || "" });
      toast.success("Return delivery to vendor marked successfully");
      await fetchAssignments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Delivery failed");
    } finally {
      setActionLoadingId("");
    }
  };

  const onMarkHubDelivered = async (row) => {
    try {
      setActionLoadingId(row._id);
      const coords = await getCurrentPosition();
      await pickupApi.markHubDelivered(row._id, {
        lat: coords.latitude,
        lng: coords.longitude,
        notes: notesById[row._id] || "",
        hubImageUrl: hubImageById[row._id] || "",
      });
      toast.success("Assignment delivered to hub");
      await fetchAssignments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Hub delivery failed");
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Premium Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Truck size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Pickup Center</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                {user?.name || "Partner"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchAssignments}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button 
              onClick={logout}
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={stat.label}
              className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center"
            >
              <div className={`${stat.bg} ${stat.color} p-2 rounded-xl mb-1`}>
                <stat.icon size={16} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
              <span className="text-xl font-black text-slate-900 leading-none">{stat.value}</span>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {["active", "pickup_assigned", "picked", "hub_delivered", "return_pickup", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                statusFilter === f 
                  ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {f.replace(/_/g, " ").toUpperCase()}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {loading && rows.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="h-10 w-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-400 uppercase">Fetching Tasks...</p>
              </div>
            ) : rows.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300"
              >
                <Package className="mx-auto text-slate-200 mb-2" size={48} />
                <p className="text-sm font-bold text-slate-400 uppercase">No Tasks Available</p>
              </motion.div>
            ) : (
              rows.map((row) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={row._id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="p-5 space-y-4">
                    {/* Top Row: Request ID & Status */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                          {row.status.replace("_", " ")}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          #{row.requestId}
                          <ChevronRight size={14} className="text-slate-300" />
                        </h3>
                      </div>
                      <div className="text-right text-xs text-slate-600 space-y-0.5">
                        <p>
                          <span className="text-slate-400">Requested </span>
                          {formatPrDate(row.createdAt)}
                        </p>
                        {row.dates?.pickupAssignedAt && (
                          <p>
                            <span className="text-slate-400">Assigned </span>
                            {formatPrDate(row.dates.pickupAssignedAt)}
                          </p>
                        )}
                        {row.eta && (
                          <p className="text-indigo-600 font-semibold">ETA {formatPrDate(row.eta)}</p>
                        )}
                      </div>
                    </div>

                    {/* Vendor Card */}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-3 group hover:bg-slate-100 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                            <Store size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{row.vendor?.shopName || row.vendor?.name || "Vendor"}</p>
                            <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                              <MapPin size={10} /> Location Verified
                            </p>
                          </div>
                        </div>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (row.status === 'picked') {
                              const hubDest = { lat: 22.7196, lng: 75.8577 };
                              openDirections(hubDest);
                            } else {
                              const dest = toLatLng(row.vendor?.location);
                              if (!dest) {
                                toast.error("Vendor location not available");
                                return;
                              }
                              openDirections(dest);
                            }
                          }}
                          className={`h-10 w-10 ${row.status === 'picked' ? 'bg-emerald-500' : 'bg-sky-500'} text-white rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-95`}
                        >
                          <Navigation size={18} />
                        </a>
                      </div>

                      {/* Dynamic Workflow Map Preview */}
                      {(() => {
                        const partnerLoc = user?.location?.coordinates?.length >= 2 ? toLatLng(user.location) : null;
                        const vendorLoc = toLatLng(row.vendor?.location);
                        const hubLoc = { lat: 22.7196, lng: 75.8577 }; // Central Hub
                        
                        if (!partnerLoc) {
                          return (
                            <div className="h-28 w-full bg-slate-50 rounded-xl flex flex-col items-center justify-center border border-dashed border-slate-200">
                              <MapPin className="text-slate-300 mb-1" size={20} />
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Set your location in Profile</p>
                            </div>
                          );
                        }

                        // Determine Target based on Status
                        const isPicked = row.status === 'picked' || row.status === 'hub_delivered';
                        const targetLoc = isPicked ? hubLoc : vendorLoc;
                        const targetLabel = isPicked ? 'HUB' : 'SHOP';
                        const targetColor = isPicked ? '0x10b981' : '0xe11d48';

                        if (!targetLoc) return null;

                        return (
                          <div className="h-56 w-full rounded-[32px] overflow-hidden relative border-4 border-white shadow-2xl bg-slate-200">
                            <img 
                              src={`https://maps.googleapis.com/maps/api/staticmap?size=800x400&maptype=roadmap&markers=size:mid%7Ccolor:0x4f46e5%7Clabel:P%7C${partnerLoc.lat},${partnerLoc.lng}&markers=size:mid%7Ccolor:${targetColor}%7Clabel:T%7C${targetLoc.lat},${targetLoc.lng}&path=color:0x4f46e5aa%7Cweight:5%7C${partnerLoc.lat},${partnerLoc.lng}%7C${targetLoc.lat},${targetLoc.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}`}
                              alt="Workflow Route"
                              className="w-full h-full object-cover"
                            />
                            
                            <div className="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/40 to-transparent flex justify-between items-start">
                              <div className="flex gap-2">
                                <div className="bg-white/95 backdrop-blur px-3 py-1 rounded-lg shadow-lg">
                                  <p className="text-[8px] font-black text-slate-500 uppercase leading-none mb-1">From</p>
                                  <p className="text-[10px] font-black text-indigo-600 leading-none uppercase">You (Home)</p>
                                </div>
                                <div className={`bg-white/95 backdrop-blur px-3 py-1 rounded-lg shadow-lg border-b-2 ${isPicked ? 'border-emerald-500' : 'border-rose-500'}`}>
                                  <p className="text-[8px] font-black text-slate-500 uppercase leading-none mb-1">Next Destination</p>
                                  <p className={`text-[10px] font-black ${isPicked ? 'text-emerald-600' : 'text-rose-600'} leading-none uppercase`}>{targetLabel}</p>
                                </div>
                              </div>
                            </div>

                            <div className="absolute bottom-4 left-4 right-4 flex justify-center">
                               <div className="bg-slate-900/90 backdrop-blur-xl px-4 py-2 rounded-2xl shadow-2xl border border-white/20">
                                  <p className="text-[10px] font-black text-white uppercase tracking-[2px] flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full animate-pulse ${isPicked ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.8)]'}`}/> 
                                    {isPicked ? "Phase 2: Delivering to Hub" : "Phase 1: Heading to Vendor"}
                                  </p>
                               </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Products List */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items to Pickup</h4>
                      <div className="space-y-1.5">
                        {(row.products || []).map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-700">{p.name || "Product Item"}</p>
                            {row.status === "pickup_assigned" ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Target: {p.qty}</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={p.qty}
                                  value={pickedQtyById[row._id]?.[p.productId] ?? p.qty}
                                  onChange={(e) =>
                                    setPickedQtyById((prev) => ({
                                      ...prev,
                                      [row._id]: {
                                        ...prev[row._id],
                                        [p.productId]: Math.min(p.qty, Math.max(0, parseInt(e.target.value) || 0)),
                                      },
                                    }))
                                  }
                                  className="w-16 bg-slate-100 border-none rounded-lg px-2 py-1 text-xs font-black text-slate-900 text-center"
                                />
                              </div>
                            ) : (
                              <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">x{p.actualPickedQty ?? p.qty} / {p.qty}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions Area */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="mb-3 grid grid-cols-1 gap-2">
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={notesById[row._id] || ""}
                          onChange={(e) =>
                            setNotesById((prev) => ({ ...prev, [row._id]: e.target.value }))
                          }
                          className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900 transition-all"
                        />
                        {row.status === "pickup_assigned" ? (
                          <div className="grid grid-cols-1 gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                uploadProof(row._id, e.target.files?.[0], "vendor")
                              }
                              className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-[10px] file:font-black file:text-white"
                            />
                            <input
                              type="text"
                              placeholder="Vendor proof image URL (optional)"
                              value={vendorImageById[row._id] || ""}
                              onChange={(e) =>
                                setVendorImageById((prev) => ({ ...prev, [row._id]: e.target.value }))
                              }
                              className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900 transition-all"
                            />
                            {uploadingId === row._id && (
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Uploading proof...
                              </p>
                            )}
                          </div>
                        ) : row.status === "picked" ? (
                          <div className="grid grid-cols-1 gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                uploadProof(row._id, e.target.files?.[0], "hub")
                              }
                              className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-[10px] file:font-black file:text-white"
                            />
                            <input
                              type="text"
                              placeholder="Hub proof image URL (optional)"
                              value={hubImageById[row._id] || ""}
                              onChange={(e) =>
                                setHubImageById((prev) => ({ ...prev, [row._id]: e.target.value }))
                              }
                              className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900 transition-all"
                            />
                            {uploadingId === row._id && (
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Uploading proof...
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                      {row.status === "pickup_assigned" ? (
                        <div className="space-y-3">
                          <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                              type="text"
                              placeholder="ENTER HANDOVER OTP"
                              value={otpById[row._id] || ""}
                              onChange={(e) =>
                                setOtpById((prev) => ({
                                  ...prev,
                                  [row._id]: e.target.value.replace(/\D/g, "").slice(0, 4),
                                }))
                              }
                              className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-black text-slate-900 placeholder:text-slate-300 placeholder:font-bold focus:ring-2 focus:ring-slate-900 transition-all tracking-[0.5em]"
                            />
                            {row.pickupOtp && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                                YOUR OTP: {row.pickupOtp}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => onCancelPickup(row)}
                              disabled={actionLoadingId === row._id}
                              className="w-1/3 bg-slate-100 text-slate-500 hover:bg-slate-200 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => onMarkPicked(row)}
                              disabled={actionLoadingId === row._id}
                              className="w-2/3 bg-slate-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50"
                            >
                              {actionLoadingId === row._id ? "Verifying..." : "CONFIRM PICKUP"}
                            </button>
                          </div>
                        </div>
                      ) : row.status === "return_pickup" ? (
                        <button
                          type="button"
                          onClick={() => onMarkReturnDelivered(row)}
                          disabled={actionLoadingId === row._id}
                          className="w-full bg-purple-600 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-purple-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {actionLoadingId === row._id ? "Processing..." : "RETURN DROPPED AT SHOP"}
                        </button>
                      ) : row.status === "picked" ? (
                        <button
                          type="button"
                          onClick={() => onMarkHubDelivered(row)}
                          disabled={actionLoadingId === row._id}
                          className="w-full bg-emerald-600 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {actionLoadingId === row._id ? (
                            "Processing..."
                          ) : (
                            <>
                              <CheckCircle size={14} />
                              COMPLETE HUB DELIVERY
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="bg-slate-50 p-3 rounded-2xl text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                            <CheckCircle size={12} className="text-emerald-500" />
                            Assignment Completed
                          </p>
                        </div>
                      )}
                    </div>

                    {row.timeline?.length > 0 && (
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Trip history</p>
                        <PurchaseRequestTimeline timeline={row.timeline} compact />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
        
        {/* Earnings History Section */}
        <div className="space-y-4 mt-12 pb-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Earnings History</h2>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Recent Completed Trips</span>
          </div>

          <div className="space-y-3">
            {rows.filter(r => r.status === 'hub_delivered').length === 0 ? (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 text-center">
                <p className="text-xs font-bold text-slate-400 uppercase">No earnings recorded yet</p>
              </div>
            ) : (
              rows.filter(r => r.status === 'hub_delivered').map((trip) => (
                <div key={trip._id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                      <Truck size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Trip #{trip.requestId}</p>
                      <p className="text-[10px] font-medium text-slate-500">To: Central Hub</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-600">+₹{profile?.baseTripRate || 0}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Trip Credit</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
  const uploadProof = async (rowId, file, type) => {
    try {
      if (!file) return;
      setUploadingId(rowId);
      const fd = new FormData();
      fd.append("image", file);
      const res = await pickupApi.uploadProofImage(fd, type);
      const url = res?.data?.result?.url || "";
      if (!url) throw new Error("Upload failed");
      if (type === "hub") {
        setHubImageById((prev) => ({ ...prev, [rowId]: url }));
      } else {
        setVendorImageById((prev) => ({ ...prev, [rowId]: url }));
      }
      toast.success("Proof uploaded");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Proof upload failed");
    } finally {
      setUploadingId("");
    }
  };
