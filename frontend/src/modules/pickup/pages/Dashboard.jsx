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

const emptyStepState = () => ({
  step: "assigned",
  navigating: false,
  images: [],
  otp: "",
  otpGenerated: false,
  otpVerified: false,
});

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [statusFilter, setStatusFilter] = useState("active");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [notesById, setNotesById] = useState({});
  const [hubImagesById, setHubImagesById] = useState({});
  const [pickedQtyById, setPickedQtyById] = useState({});
  const [uploadingId, setUploadingId] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [profile, setProfile] = useState(null);
  const [liveLoc, setLiveLoc] = useState(null);
  const [flowById, setFlowById] = useState({});
  const [navTargetId, setNavTargetId] = useState(null);

  const patchFlow = (id, patch) => {
    setFlowById((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || emptyStepState()), ...patch },
    }));
  };

  const getFlow = (id) => flowById[id] || emptyStepState();

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

  const uploadOne = async (file, type, source) => {
    const fd = new FormData();
    fd.append("image", file);
    const res = await pickupApi.uploadProofImage(fd, type, (evt) => {
      if (!evt.total) return;
      setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
    });
    const url = res?.data?.result?.url || "";
    if (!url) throw new Error("Upload failed");
    return { url, source };
  };

  useEffect(() => {
    fetchAssignments();
    const timer = setInterval(fetchAssignments, 15000);
    return () => clearInterval(timer);
  }, [statusFilter]);

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
          /* non-blocking */
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [rows]);

  useEffect(() => {
    setFlowById((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (row.status !== "pickup_assigned") continue;
        const cur = next[row._id] || emptyStepState();
        let step = cur.step;
        if (row.pickupOtpVerified) step = "otp_verified";
        else if (row.pickupOtpGenerated) step = cur.images?.length ? "otp_generated" : step;
        next[row._id] = {
          ...cur,
          otpGenerated: Boolean(row.pickupOtpGenerated || cur.otpGenerated),
          otpVerified: Boolean(row.pickupOtpVerified || cur.otpVerified),
          step,
        };
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
    ];
  }, [rows]);

  const onNavigate = (row) => {
    setNavTargetId(row._id);
    patchFlow(row._id, { navigating: true, step: "navigating" });
    toast.message("Navigating… follow the in-app map");
  };

  const onReachedSeller = async (row) => {
    try {
      setActionLoadingId(`${row._id}:reached`);
      let coords = null;
      try {
        coords = await getCurrentPosition();
      } catch {
        /* optional */
      }
      await pickupApi.markReachedSeller(row._id, {
        lat: coords?.latitude,
        lng: coords?.longitude,
      });
      patchFlow(row._id, { step: "reached", navigating: true });
      toast.success("Reached seller — upload parcel photos");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not mark reached");
    } finally {
      setActionLoadingId("");
    }
  };

  const onAddImages = async (rowId, files, source) => {
    const flow = getFlow(rowId);
    const room = Math.max(0, 4 - flow.images.length);
    const batch = files.slice(0, room);
    if (!batch.length) return;
    try {
      setUploadingId(rowId);
      setUploadProgress(0);
      const uploaded = [];
      for (const file of batch) {
        uploaded.push(await uploadOne(file, "vendor", source));
      }
      const images = [...flow.images, ...uploaded].slice(0, 4);
      patchFlow(rowId, {
        images,
        step: images.length ? "images" : flow.step,
      });
      toast.success(`${uploaded.length} photo(s) uploaded`);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Upload failed");
    } finally {
      setUploadingId("");
      setUploadProgress(0);
    }
  };

  const onReplaceImage = async (rowId, index, file, source) => {
    try {
      setUploadingId(rowId);
      setUploadProgress(0);
      const uploaded = await uploadOne(file, "vendor", source);
      const flow = getFlow(rowId);
      const images = [...flow.images];
      images[index] = uploaded;
      patchFlow(rowId, { images });
      toast.success("Photo updated");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Replace failed");
    } finally {
      setUploadingId("");
      setUploadProgress(0);
    }
  };

  const onGenerateOtp = async (row) => {
    const flow = getFlow(row._id);
    const urls = flow.images.map((i) => i.url).filter(Boolean);
    if (urls.length < 1) {
      toast.error("Upload at least one parcel photo first");
      return;
    }
    try {
      setActionLoadingId(`${row._id}:otp`);
      await pickupApi.generatePickupOtp(row._id, {
        vendorImageUrl: urls[0],
        vendorImageUrls: urls,
      });
      patchFlow(row._id, {
        otpGenerated: true,
        otpVerified: false,
        otp: "",
        step: "otp_generated",
      });
      toast.success("OTP generated — ask seller for the code");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to generate OTP");
    } finally {
      setActionLoadingId("");
    }
  };

  const onVerifyOtp = async (row) => {
    const flow = getFlow(row._id);
    const otp = String(flow.otp || "").trim();
    if (!otp) {
      toast.error("Enter the OTP from the seller");
      return;
    }
    try {
      setActionLoadingId(`${row._id}:verify`);
      await pickupApi.verifyPickupOtp(row._id, { otp });
      patchFlow(row._id, { otpVerified: true, step: "otp_verified" });
      toast.success("OTP verified — confirm pickup");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Invalid OTP");
    } finally {
      setActionLoadingId("");
    }
  };

  const onMarkPicked = async (row) => {
    const flow = getFlow(row._id);
    const urls = flow.images.map((i) => i.url).filter(Boolean);
    const otp = String(flow.otp || "").trim();
    if (!flow.otpVerified) {
      toast.error("Verify OTP before confirming pickup");
      return;
    }
    if (urls.length < 1) {
      toast.error("Parcel image is required");
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
        vendorImageUrl: urls[0],
        vendorImageUrls: urls,
        items,
      });
      patchFlow(row._id, { step: "confirmed" });
      toast.success(`Pickup complete from ${row.vendor?.name || "Vendor"}`);
      await fetchAssignments();
    } catch (error) {
      const msg = error?.response?.data?.message || "Confirmation failed";
      toast.error(msg);
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

  const onMarkHubDelivered = async (row) => {
    const urls = (hubImagesById[row._id] || []).map((i) => i.url);
    if (!urls.length) {
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
        hubImageUrl: urls[0],
      });
      toast.success("Assignment delivered to hub");
      await fetchAssignments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Hub delivery failed");
    } finally {
      setActionLoadingId("");
    }
  };

  const uploadHubImages = async (rowId, files, source) => {
    try {
      setUploadingId(rowId);
      setUploadProgress(0);
      const existing = hubImagesById[rowId] || [];
      const room = Math.max(0, 4 - existing.length);
      const uploaded = [];
      for (const file of files.slice(0, room)) {
        uploaded.push(await uploadOne(file, "hub", source));
      }
      setHubImagesById((prev) => ({
        ...prev,
        [rowId]: [...(prev[rowId] || []), ...uploaded].slice(0, 4),
      }));
      toast.success("Hub photo uploaded");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Upload failed");
    } finally {
      setUploadingId("");
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg">
              <Truck size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                Pickup Center
              </h1>
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {user?.name || "Partner"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={fetchAssignments}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-full p-2 text-rose-500 hover:bg-rose-50"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-3 py-5 sm:px-4 sm:py-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className={`${stat.bg} rounded-2xl p-3`}>
              <stat.icon className={`${stat.color} mb-1`} size={16} />
              <p className="text-lg font-black text-slate-900">{stat.value}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {["active", "all", "hub_delivered"].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                statusFilter === key
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-500"
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
                const flow = getFlow(row._id);
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
                const showMap =
                  navTargetId === row._id ||
                  flow.navigating ||
                  ["navigating", "reached", "images", "otp_generated", "otp_verified"].includes(
                    flow.step,
                  );

                const reached = ["reached", "images", "otp_generated", "otp_verified", "confirmed"].includes(
                  flow.step,
                );
                const hasImages = flow.images.length >= 1;
                const canGenerateOtp = reached && hasImages && !flow.otpGenerated;
                const canEnterOtp = flow.otpGenerated && !flow.otpVerified;
                const canConfirm = flow.otpVerified;

                return (
                  <motion.div
                    key={row._id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm sm:rounded-[28px]"
                  >
                    <div className="space-y-4 p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                            <Store size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">
                              {row.vendor?.name || "Seller"}
                            </p>
                            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              #{row.requestId} · {row.status?.replace(/_/g, " ")}
                            </p>
                            <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                              Assigned {formatPrDate(row.pickupAssignedAt || row.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* STEP 1 — Navigate always visible for assigned / picked */}
                      {(row.status === "pickup_assigned" || row.status === "picked") && (
                        <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                                Step 1 · Navigate
                              </p>
                              <p className="text-xs font-semibold text-slate-600">
                                {flow.navigating || navTargetId === row._id
                                  ? "Navigating…"
                                  : `Open in-app route to ${targetLabel}`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => onNavigate(row)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-sky-200 active:scale-[0.98] sm:w-auto"
                            >
                              <Navigation size={16} />
                              Navigate
                            </button>
                          </div>
                        </div>
                      )}

                      {showMap && (
                        <InAppNavMap
                          partnerLoc={partnerLoc}
                          targetLoc={targetLoc}
                          targetLabel={targetLabel}
                          phaseLabel={
                            flow.navigating && !reached
                              ? "Navigating…"
                              : undefined
                          }
                        />
                      )}

                      {row.status === "pickup_assigned" && (
                        <>
                          {/* Qty controls */}
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              Items to Pickup
                            </h4>
                            {(row.products || []).map((p, idx) => (
                              <div
                                key={idx}
                                className="flex flex-wrap items-center justify-between gap-2"
                              >
                                <p className="text-xs font-semibold text-slate-700">
                                  {p.name || "Product"}
                                </p>
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
                                          [p.productId]: Math.min(
                                            p.qty,
                                            Math.max(0, parseInt(e.target.value) || 0),
                                          ),
                                        },
                                      }))
                                    }
                                    className="w-16 rounded-lg border-none bg-slate-100 px-2 py-1 text-center text-xs font-black"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

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

                          {/* STEP 2 — Reached seller */}
                          {!reached && (
                            <div className="space-y-2 rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                                Step 2 · Arrive at seller
                              </p>
                              <SlideToAction
                                label="Slide · I have reached seller"
                                colorClass="bg-amber-600"
                                loading={actionLoadingId === `${row._id}:reached`}
                                onConfirm={() => onReachedSeller(row)}
                              />
                              <button
                                type="button"
                                onClick={() => onReachedSeller(row)}
                                disabled={!!actionLoadingId}
                                className="w-full rounded-xl bg-white py-3 text-[10px] font-black uppercase tracking-widest text-amber-700 border border-amber-200"
                              >
                                I have reached seller
                              </button>
                            </div>
                          )}

                          {/* STEP 3 — Images (only after reached) */}
                          {reached && !flow.otpGenerated && (
                            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Step 3 · Parcel images
                              </p>
                              <ParcelPhotoCapture
                                images={flow.images}
                                uploading={uploadingId === row._id}
                                uploadProgress={uploadProgress}
                                onAddFiles={(files, source) =>
                                  onAddImages(row._id, files, source || "gallery")
                                }
                                onRemove={(index) => {
                                  const images = flow.images.filter((_, i) => i !== index);
                                  patchFlow(row._id, {
                                    images,
                                    step: images.length ? "images" : "reached",
                                  });
                                }}
                                onReplace={(index, file, source) =>
                                  onReplaceImage(row._id, index, file, source)
                                }
                              />
                            </div>
                          )}

                          {/* STEP 4 — Generate OTP (only after images, hide after generated) */}
                          {canGenerateOtp && (
                            <div className="space-y-2 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
                                Step 4 · Generate OTP
                              </p>
                              <SlideToAction
                                label="Slide to Generate OTP"
                                colorClass="bg-indigo-600"
                                disabled={!hasImages}
                                loading={actionLoadingId === `${row._id}:otp`}
                                onConfirm={() => onGenerateOtp(row)}
                              />
                            </div>
                          )}

                          {/* Show uploaded thumbs after OTP generated */}
                          {flow.otpGenerated && flow.images.length > 0 && (
                            <div className="grid grid-cols-4 gap-2">
                              {flow.images.map((img, i) => (
                                <img
                                  key={i}
                                  src={img.url}
                                  alt=""
                                  className="aspect-square rounded-xl object-cover border border-slate-100"
                                />
                              ))}
                            </div>
                          )}

                          {/* STEP 5 — Enter + verify OTP */}
                          {canEnterOtp && (
                            <div className="space-y-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                                Step 5 · Verify OTP
                              </p>
                              <p className="text-xs font-semibold text-slate-600">
                                Ask the seller for the OTP, then enter it below.
                              </p>
                              <div className="relative">
                                <KeyRound
                                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                  size={16}
                                />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="ENTER SELLER OTP"
                                  value={flow.otp}
                                  onChange={(e) =>
                                    patchFlow(row._id, {
                                      otp: e.target.value.replace(/\D/g, "").slice(0, 4),
                                    })
                                  }
                                  className="w-full rounded-2xl border-none bg-white py-3 pl-10 pr-4 text-sm font-black tracking-[0.5em] text-slate-900 placeholder:tracking-widest placeholder:text-slate-300 focus:ring-2 focus:ring-violet-500"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => onVerifyOtp(row)}
                                disabled={
                                  actionLoadingId === `${row._id}:verify` ||
                                  String(flow.otp || "").length < 4
                                }
                                className="w-full rounded-2xl bg-violet-600 py-3.5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
                              >
                                {actionLoadingId === `${row._id}:verify`
                                  ? "Verifying…"
                                  : "Verify OTP"}
                              </button>
                            </div>
                          )}

                          {/* STEP 6 — Confirm pickup (only after OTP verified) */}
                          {canConfirm && (
                            <div className="space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                Step 6 · Confirm pickup
                              </p>
                              <SlideToAction
                                label="Slide to Confirm Pickup"
                                colorClass="bg-slate-900"
                                loading={actionLoadingId === row._id}
                                onConfirm={() => onMarkPicked(row)}
                              />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => onCancelPickup(row)}
                            disabled={!!actionLoadingId}
                            className="w-full rounded-2xl bg-slate-100 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500"
                          >
                            Cancel Assignment
                          </button>
                        </>
                      )}

                      {row.status === "picked" && (
                        <div className="space-y-3">
                          <ParcelPhotoCapture
                            label="Hub drop photos"
                            images={hubImagesById[row._id] || []}
                            uploading={uploadingId === row._id}
                            uploadProgress={uploadProgress}
                            onAddFiles={(files, source) =>
                              uploadHubImages(row._id, files, source || "gallery")
                            }
                            onRemove={(index) =>
                              setHubImagesById((prev) => ({
                                ...prev,
                                [row._id]: (prev[row._id] || []).filter((_, i) => i !== index),
                              }))
                            }
                            onReplace={async (index, file, source) => {
                              try {
                                setUploadingId(row._id);
                                const uploaded = await uploadOne(file, "hub", source);
                                setHubImagesById((prev) => {
                                  const list = [...(prev[row._id] || [])];
                                  list[index] = uploaded;
                                  return { ...prev, [row._id]: list };
                                });
                              } catch (e) {
                                toast.error(e?.message || "Replace failed");
                              } finally {
                                setUploadingId("");
                              }
                            }}
                          />
                          <SlideToAction
                            label="Slide complete hub delivery"
                            colorClass="bg-emerald-600"
                            disabled={(hubImagesById[row._id] || []).length < 1}
                            loading={actionLoadingId === row._id}
                            onConfirm={() => onMarkHubDelivered(row)}
                          />
                        </div>
                      )}

                      {row.status === "hub_delivered" && (
                        <div className="rounded-2xl bg-slate-50 p-3 text-center">
                          <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            <CheckCircle size={12} className="text-emerald-500" />
                            Assignment Completed
                          </p>
                        </div>
                      )}

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
      </main>
    </div>
  );
};

export default Dashboard;
