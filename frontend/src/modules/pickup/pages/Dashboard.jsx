import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@core/context/AuthContext";
import { toast } from "sonner";
import { pickupApi } from "../services/pickupApi";
import {
  Package,
  CheckCircle,
  Truck,
  LogOut,
  RefreshCw,
  Clock,
  Store,
  KeyRound,
  Navigation,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PurchaseRequestTimeline from "@shared/components/PurchaseRequestTimeline";
import { formatPrDate } from "@shared/utils/purchaseRequestFormat";
import ParcelPhotoCapture from "../components/ParcelPhotoCapture";
import SlideToAction from "../components/SlideToAction";
import InAppNavMap from "../components/InAppNavMap";

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

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [statusFilter, setStatusFilter] = useState("active");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [otpById, setOtpById] = useState({});
  const [otpReadyById, setOtpReadyById] = useState({});
  const [notesById, setNotesById] = useState({});
  const [vendorImageById, setVendorImageById] = useState({});
  const [hubImageById, setHubImageById] = useState({});
  const [pickedQtyById, setPickedQtyById] = useState({});
  const [uploadingId, setUploadingId] = useState("");
  const [profile, setProfile] = useState(null);
  const [liveLoc, setLiveLoc] = useState(null);

  const fetchProfile = async () => {
    try {
      const res = await pickupApi.getMyProfile();
      if (res?.data?.success) setProfile(res.data.result);
    } catch (e) {
      console.error(e);
    }
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

  useEffect(() => {
    fetchAssignments();
    const timer = setInterval(() => {
      fetchAssignments();
    }, 15000);
    return () => clearInterval(timer);
  }, [statusFilter]);

  // Live GPS → backend (seller/admin can track). No delivery tracking changes.
  useEffect(() => {
    if (!navigator.geolocation) return undefined;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        };
        setLiveLoc(next);
        const active = rows.find((r) =>
          ["pickup_assigned", "picked"].includes(r.status),
        );
        try {
          await pickupApi.updateLiveLocation({
            ...next,
            assignmentId: active?._id || null,
          });
        } catch {
          // Non-blocking heartbeat
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [rows]);

  useEffect(() => {
    setOtpReadyById((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (row.pickupOtpGenerated) next[row._id] = true;
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
      {
        label: "Earnings",
        value: `₹${Number(profile?.walletBalance || user?.walletBalance || 0).toFixed(0)}`,
        icon: Navigation,
        color: "text-indigo-600",
        bg: "bg-indigo-50",
      },
    ];
  }, [rows, profile, user]);

  const onGenerateOtp = async (row) => {
    const imageUrl = vendorImageById[row._id];
    if (!imageUrl) {
      toast.error("Take a parcel photo before generating OTP");
      return;
    }
    try {
      setActionLoadingId(`${row._id}:otp`);
      await pickupApi.generatePickupOtp(row._id, { vendorImageUrl: imageUrl });
      setOtpReadyById((prev) => ({ ...prev, [row._id]: true }));
      toast.success("OTP generated — ask seller to share the code");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to generate OTP");
    } finally {
      setActionLoadingId("");
    }
  };

  const onMarkPicked = async (row) => {
    const otp = String(otpById[row._id] || "").trim();
    const imageUrl = vendorImageById[row._id];
    if (!imageUrl) {
      toast.error("Parcel image is required");
      return;
    }
    if (!otpReadyById[row._id] && !row.pickupOtpGenerated) {
      toast.error("Generate OTP first");
      return;
    }
    if (!otp) {
      toast.error("Enter the OTP shared by the seller");
      return;
    }

    try {
      setActionLoadingId(row._id);
      const coords = await getCurrentPosition();
      const items = Object.entries(pickedQtyById[row._id] || {}).map(
        ([productId, actualPickedQty]) => ({
          productId,
          actualPickedQty: Number(actualPickedQty),
        }),
      );
      await pickupApi.markPicked(row._id, {
        otp,
        lat: coords.latitude,
        lng: coords.longitude,
        notes: notesById[row._id] || "",
        vendorImageUrl: imageUrl,
        items,
      });
      toast.success(`Pickup complete from ${row.vendor?.name || "Vendor"}`);
      await fetchAssignments();
    } catch (error) {
      const msg = error?.response?.data?.message || "Verification failed";
      toast.error(msg, {
        description: msg.includes("far")
          ? "Please ensure you are at the vendor's shop location."
          : "",
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
      await pickupApi.markReturnDelivered(row._id, {
        notes: notesById[row._id] || "",
      });
      toast.success("Return delivery to vendor marked successfully");
      await fetchAssignments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Delivery failed");
    } finally {
      setActionLoadingId("");
    }
  };

  const onMarkHubDelivered = async (row) => {
    if (!hubImageById[row._id]) {
      toast.error("Hub drop image is required");
      return;
    }
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
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg">
              <Truck size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Pickup Center
              </h1>
              <p className="text-[10px] font-bold uppercase leading-none tracking-widest text-slate-400">
                {user?.name || "Partner"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAssignments}
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={logout}
              className="rounded-full p-2 text-rose-500 transition-colors hover:bg-rose-50"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="grid grid-cols-3 gap-3">
          {stats.slice(0, 3).map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${stat.bg} rounded-2xl p-3`}
            >
              <stat.icon className={`${stat.color} mb-1`} size={16} />
              <p className="text-lg font-black text-slate-900">{stat.value}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2">
          {["active", "all", "hub_delivered"].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                statusFilter === key
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              {key === "hub_delivered" ? "Done" : key}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {loading && rows.length === 0 ? (
              <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-slate-400">
                Loading assignments...
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center">
                <Package className="mx-auto mb-2 text-slate-300" size={28} />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  No assignments
                </p>
              </div>
            ) : (
              rows.map((row) => {
                const partnerLoc =
                  liveLoc ||
                  (user?.location?.coordinates?.length >= 2
                    ? toLatLng(user.location)
                    : null);
                const vendorLoc = toLatLng(row.vendor?.location);
                const hubLoc = { lat: 22.7196, lng: 75.8577 };
                const isPicked =
                  row.status === "picked" || row.status === "hub_delivered";
                const targetLoc = isPicked ? hubLoc : vendorLoc;
                const targetLabel = isPicked ? "HUB" : "SHOP";
                const otpReady = otpReadyById[row._id] || row.pickupOtpGenerated;

                return (
                  <motion.div
                    key={row._id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm"
                  >
                    <div className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                            <Store size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">
                              {row.vendor?.name || "Seller"}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              #{row.requestId} · {row.status?.replace(/_/g, " ")}
                            </p>
                            <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                              Assigned {formatPrDate(row.pickupAssignedAt || row.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <InAppNavMap
                        partnerLoc={partnerLoc}
                        targetLoc={targetLoc}
                        targetLabel={targetLabel}
                      />

                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Items to Pickup
                        </h4>
                        <div className="space-y-1.5">
                          {(row.products || []).map((p, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between"
                            >
                              <p className="text-xs font-semibold text-slate-700">
                                {p.name || "Product Item"}
                              </p>
                              {row.status === "pickup_assigned" ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400">
                                    Target: {p.qty}
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={p.qty}
                                    value={
                                      pickedQtyById[row._id]?.[p.productId] ?? p.qty
                                    }
                                    onChange={(e) =>
                                      setPickedQtyById((prev) => ({
                                        ...prev,
                                        [row._id]: {
                                          ...prev[row._id],
                                          [p.productId]: Math.min(
                                            p.qty,
                                            Math.max(0, parseInt(e.target.value) || 0),
                                          ),
                                        },
                                      }))
                                    }
                                    className="w-16 rounded-lg border-none bg-slate-100 px-2 py-1 text-center text-xs font-black text-slate-900"
                                  />
                                </div>
                              ) : (
                                <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-900">
                                  x{p.actualPickedQty ?? p.qty} / {p.qty}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 border-t border-slate-100 pt-3">
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={notesById[row._id] || ""}
                          onChange={(e) =>
                            setNotesById((prev) => ({
                              ...prev,
                              [row._id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border-none bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900"
                        />

                        {row.status === "pickup_assigned" ? (
                          <div className="space-y-3">
                            <ParcelPhotoCapture
                              label="Parcel photo (required)"
                              imageUrl={vendorImageById[row._id]}
                              uploading={uploadingId === row._id}
                              onUpload={(file) => uploadProof(row._id, file, "vendor")}
                              onClear={() =>
                                setVendorImageById((prev) => ({
                                  ...prev,
                                  [row._id]: "",
                                }))
                              }
                            />

                            <SlideToAction
                              label="Slide to generate OTP"
                              colorClass="bg-indigo-600"
                              disabled={!vendorImageById[row._id]}
                              loading={actionLoadingId === `${row._id}:otp`}
                              onConfirm={() => onGenerateOtp(row)}
                            />

                            {otpReady && (
                              <div className="relative">
                                <KeyRound
                                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                  size={16}
                                />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="ENTER SELLER OTP"
                                  value={otpById[row._id] || ""}
                                  onChange={(e) =>
                                    setOtpById((prev) => ({
                                      ...prev,
                                      [row._id]: e.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 4),
                                    }))
                                  }
                                  className="w-full rounded-2xl border-none bg-slate-50 py-3 pl-10 pr-4 text-sm font-black tracking-[0.5em] text-slate-900 placeholder:font-bold placeholder:tracking-widest placeholder:text-slate-300 focus:ring-2 focus:ring-slate-900"
                                />
                              </div>
                            )}

                            <SlideToAction
                              label="Slide confirm pickup"
                              colorClass="bg-slate-900"
                              disabled={
                                !vendorImageById[row._id] ||
                                !otpReady ||
                                !String(otpById[row._id] || "").trim()
                              }
                              loading={actionLoadingId === row._id}
                              onConfirm={() => onMarkPicked(row)}
                            />

                            <button
                              type="button"
                              onClick={() => onCancelPickup(row)}
                              disabled={!!actionLoadingId}
                              className="w-full rounded-2xl bg-slate-100 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500"
                            >
                              Cancel Assignment
                            </button>
                          </div>
                        ) : row.status === "return_pickup" ? (
                          <button
                            type="button"
                            onClick={() => onMarkReturnDelivered(row)}
                            disabled={actionLoadingId === row._id}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-purple-200 disabled:opacity-50"
                          >
                            {actionLoadingId === row._id
                              ? "Processing..."
                              : "RETURN DROPPED AT SHOP"}
                          </button>
                        ) : row.status === "picked" ? (
                          <div className="space-y-3">
                            <ParcelPhotoCapture
                              label="Hub drop photo (required)"
                              imageUrl={hubImageById[row._id]}
                              uploading={uploadingId === row._id}
                              onUpload={(file) => uploadProof(row._id, file, "hub")}
                              onClear={() =>
                                setHubImageById((prev) => ({
                                  ...prev,
                                  [row._id]: "",
                                }))
                              }
                            />
                            <SlideToAction
                              label="Slide complete hub delivery"
                              colorClass="bg-emerald-600"
                              disabled={!hubImageById[row._id]}
                              loading={actionLoadingId === row._id}
                              onConfirm={() => onMarkHubDelivered(row)}
                            />
                          </div>
                        ) : (
                          <div className="rounded-2xl bg-slate-50 p-3 text-center">
                            <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              <CheckCircle size={12} className="text-emerald-500" />
                              Assignment Completed
                            </p>
                          </div>
                        )}
                      </div>

                      {row.timeline?.length > 0 && (
                        <div className="border-t border-slate-100 pt-4">
                          <p className="mb-2 text-xs font-bold uppercase text-slate-500">
                            Trip history
                          </p>
                          <PurchaseRequestTimeline timeline={row.timeline} compact />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        <div className="mt-12 space-y-4 pb-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
              Earnings History
            </h2>
            <span className="text-[10px] font-bold uppercase text-slate-400">
              Recent Completed Trips
            </span>
          </div>

          <div className="space-y-3">
            {rows.filter((r) => r.status === "hub_delivered").length === 0 ? (
              <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center">
                <p className="text-xs font-bold uppercase text-slate-400">
                  No earnings recorded yet
                </p>
              </div>
            ) : (
              rows
                .filter((r) => r.status === "hub_delivered")
                .map((trip) => (
                  <div
                    key={trip._id}
                    className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                        <Truck size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          Trip #{trip.requestId}
                        </p>
                        <p className="text-[10px] font-medium text-slate-500">
                          To: Central Hub
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-600">
                        +₹{profile?.baseTripRate || 0}
                      </p>
                      <p className="text-[9px] font-bold uppercase text-slate-400">
                        Trip Credit
                      </p>
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
