import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import Badge from "@shared/components/ui/Badge";
import Input from "@shared/components/ui/Input";
import { sellerApi } from "../services/sellerApi";
import { useToast } from "@shared/components/ui/Toast";
import { useAuth } from "@/core/context/AuthContext";
import { getOrderSocket } from "@/core/services/orderSocket";
import PurchaseRequestTimeline from "@shared/components/PurchaseRequestTimeline";
import { formatPrDate } from "@shared/utils/purchaseRequestFormat";

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Created", value: "created" },
  { label: "Vendor Confirmed", value: "vendor_confirmed" },
  { label: "Pickup Assigned", value: "pickup_assigned" },
  { label: "Picked", value: "picked" },
  { label: "Hub Delivered", value: "hub_delivered" },
  { label: "Received at Hub", value: "received_at_hub" },
  { label: "Verified", value: "verified" },
  { label: "Closed", value: "closed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Exception", value: "exception" },
];

const statusVariant = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "created":
      return "warning";
    case "vendor_confirmed":
      return "info";
    case "pickup_assigned":
      return "primary";
    case "picked":
    case "verified":
    case "closed":
      return "success";
    case "exception":
    case "cancelled":
      return "error";
    default:
      return "gray";
  }
};

const normalizeStatus = (status) => String(status || "").trim().toLowerCase();

const canRespond = (row) => {
  const st = normalizeStatus(row?.status);
  const vendorState = normalizeStatus(row?.vendorResponse?.status || "pending");
  if (vendorState !== "pending") return false;
  return ["created", "pickup_assigned"].includes(st);
};

const canCommitQuantities = (row) => {
  const st = normalizeStatus(row?.status);
  const vendorState = normalizeStatus(row?.vendorResponse?.status || "pending");
  if (vendorState !== "pending") return false;
  return ["created", "pickup_assigned"].includes(st);
};

const canMarkReady = (row) => {
  const st = normalizeStatus(row?.status);
  return ["created", "vendor_confirmed", "pickup_assigned"].includes(st);
};

const ProcurementRequests = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isVerified = user?.isVerified;
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState([]);
  const [otpMap, setOtpMap] = useState({});
  const [notesMap, setNotesMap] = useState({});
  const [commitMap, setCommitMap] = useState({});
  const [attachmentMap, setAttachmentMap] = useState({});
  const [savingId, setSavingId] = useState("");

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await sellerApi.getPurchaseRequests({ status });
      const list = res?.data?.result?.items || [];
      setRows(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Failed to load purchase orders:", error);
      showToast("Failed to load purchase orders", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    const interval = setInterval(fetchRows, 30000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    const socket = getOrderSocket(() => localStorage.getItem("auth_seller"));
    if (socket) {
      const handleNewPR = (payload) => {
        showToast("New Purchase Request Received!", "success");
        fetchRows(); // Fetch fresh data immediately
      };
      socket.on("purchase_request:new", handleNewPR);
      return () => {
        socket.off("purchase_request:new", handleNewPR);
      };
    }
  }, []);

  useEffect(() => {
    setOtpMap((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!next[row._id] && row.pickupOtp) {
          next[row._id] = String(row.pickupOtp);
        }
      }
      return next;
    });
  }, [rows]);

  useEffect(() => {
    // Default commit = full shortage for each item (seller can reduce for partial supply).
    setCommitMap((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!row?._id) continue;
        if (!next[row._id]) next[row._id] = {};
        for (const item of row.items || []) {
          const pid = String(item?.productId || "");
          if (!pid) continue;
          if (next[row._id][pid] === undefined || next[row._id][pid] === null) {
            const shortage = Number(item?.shortageQty ?? item?.requiredQty ?? 0);
            next[row._id][pid] = String(Math.max(0, shortage));
          }
        }
      }
      return next;
    });
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const open = rows.filter((r) =>
      ["created", "vendor_confirmed", "pickup_assigned"].includes(r.status),
    ).length;
    const picked = rows.filter((r) => r.status === "picked").length;
    const exception = rows.filter((r) => r.status === "exception").length;
    return { total, open, picked, exception };
  }, [rows]);

  const act = async (id, fn, successMessage) => {
    try {
      setSavingId(id);
      await fn();
      showToast(successMessage, "success");
      await fetchRows();
    } catch (error) {
      console.error("Purchase order action failed:", error);
      showToast(error?.response?.data?.message || "Action failed", "error");
    } finally {
      setSavingId("");
    }
  };

  const buildCommittedItemsPayload = (row) => {
    return (row.items || [])
      .map((it) => {
        const pid = String(it.productId?._id || it.productId || "");
        const committedQty = Number(it.shortageQty ?? it.requiredQty ?? 0);
        return { productId: pid, committedQty };
      })
      .filter((x) => x.productId);
  };

  const commitQuantities = async (row) => {
    const items = buildCommittedItemsPayload(row);
    const committed = items.map((it) => Number(it.committedQty || 0));
    const shortages = (row.items || []).map((it) =>
      Number(it.shortageQty ?? it.requiredQty ?? 0),
    );

    if (committed.every((q) => q <= 0)) {
      showToast(
        "Committed quantity must be at least 1 for one item, or reject the request.",
        "error",
      );
      return;
    }

    const fullyCommitted = committed.every((q, idx) => q >= (shortages[idx] || 0));
    const action = fullyCommitted ? "accept" : "partial";
    const attachment = String(attachmentMap[row._id] || "").trim();
    const combinedNotes = [
      String(notesMap[row._id] || "").trim(),
      attachment ? `Attachment: ${attachment}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    await act(
      `${row._id}:commit`,
      () =>
        sellerApi.respondPurchaseRequest(row._id, {
          action,
          notes: combinedNotes,
          items,
        }),
      fullyCommitted ? "Request accepted" : "Partial quantities committed",
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Purchase Orders</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 uppercase tracking-wider">
            SOP Step 9: Manage Hub Procurement Requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border-none bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button onClick={fetchRows} variant="outline" className="rounded-xl font-black text-xs uppercase tracking-widest">
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="ring-1 ring-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{stats.total}</p>
        </Card>
        <Card className="ring-1 ring-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Open</p>
          <p className="mt-2 text-2xl font-black text-amber-600">{stats.open}</p>
        </Card>
        <Card className="ring-1 ring-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Picked</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{stats.picked}</p>
        </Card>
        <Card className="ring-1 ring-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Exception</p>
          <p className="mt-2 text-2xl font-black text-rose-600">{stats.exception}</p>
        </Card>
      </div>

      <Card
        title="Assigned Requests"
        subtitle="Only requests mapped to your vendor account are shown here."
        className="ring-1 ring-slate-100"
      >
        {loading ? (
          <p className="text-sm font-semibold text-slate-600">Loading requests...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm font-semibold text-slate-500">No requests found.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div
                key={row._id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] uppercase tracking-tighter">PR Task</span>
                      {row.requestId}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Hub: <span className="font-semibold text-indigo-600">{row.hubId}</span>
                      {" · "}Requested {formatPrDate(row.createdAt)}
                      {(row.confirmedAt || row.dates?.confirmedAt) && (
                        <>
                          {" · "}Confirmed {formatPrDate(row.confirmedAt || row.dates?.confirmedAt)}
                        </>
                      )}
                    </p>
                    {row.pricing?.grandTotal != null && (
                      <p className="text-xs font-semibold text-emerald-700 mt-1">
                        Order value ₹{Number(row.pricing.grandTotal).toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(row.status)} className="font-black text-[10px] uppercase">{row.status.replace('_', ' ')}</Badge>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {(row.items || []).map((item) => (
                    <div
                      key={`${row._id}-${item.productId}`}
                      className="flex items-center gap-4 rounded-xl bg-slate-50 p-3"
                    >
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                        {item.mainImage ? (
                          <img src={item.mainImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-900">{item.productName}</p>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <span>Qty: <span className="text-indigo-600">{item.requiredQty} {item.unit}</span></span>
                          <span>Rate: <span className="text-emerald-600">₹{item.unitCost}</span></span>
                          <span>GST: <span className="text-amber-600">{item.gstRate || 0}% (₹{item.gstAmount || 0})</span></span>
                          <span className="bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700">Net Total: ₹{item.totalCost}</span>
                          <span>Shortage: <span className="text-rose-500">{item.shortageQty}</span></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  <Button
                    onClick={() =>
                      isVerified ? commitQuantities(row) : showToast("Account pending approval", "error")
                    }
                    isLoading={savingId === `${row._id}:commit`}
                    disabled={!canCommitQuantities(row) || !isVerified}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      isVerified ? act(
                        `${row._id}:reject`,
                        () =>
                          sellerApi.respondPurchaseRequest(row._id, {
                            action: "reject",
                            rejectionReason: notesMap[row._id] || "Rejected by seller",
                            notes: String(attachmentMap[row._id] || "").trim()
                              ? `Attachment: ${String(attachmentMap[row._id] || "").trim()}`
                              : "",
                          }),
                        "Request rejected",
                      ) : showToast("Account pending approval", "error")
                    }
                    disabled={!canRespond(row) || !isVerified}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      isVerified ? act(
                        `${row._id}:ready`,
                        () =>
                          sellerApi.markPurchaseRequestReady(row._id, {
                            notes: notesMap[row._id] || "",
                          }),
                        "Marked ready for pickup",
                      ) : showToast("Account pending approval", "error")
                    }
                    disabled={!canMarkReady(row) || !isVerified}
                  >
                    Mark Ready
                  </Button>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <Input
                    value={notesMap[row._id] || ""}
                    onChange={(e) =>
                      setNotesMap((prev) => ({ ...prev, [row._id]: e.target.value }))
                    }
                    placeholder="Notes / rejection reason"
                  />
                  <Input
                    value={attachmentMap[row._id] || ""}
                    onChange={(e) =>
                      setAttachmentMap((prev) => ({ ...prev, [row._id]: e.target.value }))
                    }
                    placeholder="Attachment URL (optional)"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={otpMap[row._id] || ""}
                      onChange={(e) =>
                        setOtpMap((prev) => ({
                          ...prev,
                          [row._id]: e.target.value.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                      placeholder="Pickup OTP"
                    />
                    <Button
                      variant="secondary"
                      isLoading={savingId === `${row._id}:handover`}
                      onClick={() =>
                        act(
                          `${row._id}:handover`,
                          () =>
                            sellerApi.confirmPurchaseHandover(row._id, {
                              otp: otpMap[row._id],
                              notes: notesMap[row._id] || "",
                            }),
                          "Handover OTP verified",
                        )
                      }
                      disabled={row.status !== "pickup_assigned"}
                    >
                      Verify
                    </Button>
                  </div>
                </div>

                {row.pickupPartner?.name || row.pickupPartner?.phone ? (
                  <p className="mt-2 text-xs font-semibold text-slate-600">
                    Pickup Partner: {row.pickupPartner?.name || "N/A"}{" "}
                    {row.pickupPartner?.phone ? `(${row.pickupPartner.phone})` : ""}
                  </p>
                ) : null}
                {row.timeline?.length > 0 && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Request history</p>
                    <PurchaseRequestTimeline timeline={row.timeline} compact />
                  </div>
                )}
                {row.status === "pickup_assigned" && row.pickupOtp ? (
                  <p className="mt-2 text-xs font-semibold text-slate-600">
                    Current Pickup OTP: {row.pickupOtp}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProcurementRequests;
