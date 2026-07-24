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
import PRCountdown from "@shared/components/PRCountdown";

/** Set true later to let sellers edit Accept Qty again. */
const ALLOW_SELLER_EDIT_ACCEPT_QTY = false;

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

const lineKey = (item) => {
  const pId = item?.productId?._id || item?.productId || "";
  return item?.itemKey || `${String(pId)}::${item?.variantId ? String(item.variantId) : "root"}`;
};

const canRespondLine = (row, item) => {
  if (row.requestType === "manual") return false;
  const st = normalizeStatus(row?.status);
  const vendorState = normalizeStatus(row?.vendorResponse?.status || "pending");
  const lineStatus = normalizeStatus(item?.lineStatus || "pending");
  if (lineStatus !== "pending") return false;
  if (!["created", "pickup_assigned"].includes(st)) return false;

  const isExpired = row.expiresAt ? (new Date(row.expiresAt).getTime() - (Date.now() - (window.__serverTimeOffset || 0)) <= 0) : false;
  if (isExpired) return false;

  return vendorState === "pending" || vendorState === "partial";
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
    setCommitMap((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!row?._id) continue;
        if (!next[row._id]) next[row._id] = {};
        for (const item of row.items || []) {
          const key = lineKey(item);
          if (!key) continue;
          if (next[row._id][key] === undefined || next[row._id][key] === null) {
            const shortage = Number(item?.requestedQty ?? item?.shortageQty ?? item?.requiredQty ?? 0);
            next[row._id][key] = String(Math.max(0, shortage));
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

  const acceptLine = async (row, item) => {
    const key = lineKey(item);
    const productId = String(item?.productId?._id || item?.productId || "");
    const variantId = item?.variantId || null;
    const requestedQty = Number(item?.requestedQty ?? item?.shortageQty ?? item?.requiredQty ?? 0);
    const committedQty = Math.min(
      requestedQty,
      Math.max(0, Number(commitMap[row._id]?.[key] ?? requestedQty)),
    );

    if (committedQty <= 0) {
      showToast("Enter a committed quantity of at least 1, or reject this product.", "error");
      return;
    }

    const action = committedQty >= requestedQty ? "accept_line" : "accept_line";
    const attachment = String(attachmentMap[row._id] || "").trim();
    const combinedNotes = [
      String(notesMap[row._id] || "").trim(),
      attachment ? `Attachment: ${attachment}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    await act(
      `${row._id}:${key}:accept`,
      () =>
        sellerApi.respondPurchaseRequest(row._id, {
          action,
          productId,
          variantId,
          committedQty,
          notes: combinedNotes,
        }),
      committedQty >= requestedQty ? "Product accepted" : "Partial quantity committed",
    );
  };

  const rejectLine = async (row, item) => {
    const key = lineKey(item);
    const productId = String(item?.productId?._id || item?.productId || "");
    const variantId = item?.variantId || null;
    const attachment = String(attachmentMap[row._id] || "").trim();

    await act(
      `${row._id}:${key}:reject`,
      () =>
        sellerApi.respondPurchaseRequest(row._id, {
          action: "reject_line",
          productId,
          variantId,
          rejectionReason: notesMap[row._id] || "Rejected by seller",
          notes: attachment ? `Attachment: ${attachment}` : "",
        }),
      "Product rejected",
    );
  };

  const commitQuantities = async (row) => {
    const items = (row.items || [])
      .map((it) => {
        const key = lineKey(it);
        const pid = String(it.productId?._id || it.productId || "");
        const committedQty = Number(commitMap[row._id]?.[key] ?? it.shortageQty ?? it.requiredQty ?? 0);
        return { productId: pid, variantId: it.variantId || null, committedQty };
      })
      .filter((x) => x.productId);

    const committed = items.map((it) => Number(it.committedQty || 0));
    const shortages = (row.items || []).map((it) =>
      Number(it.requestedQty ?? it.shortageQty ?? it.requiredQty ?? 0),
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

  const handleRespondManual = async (row, action) => {
    const combinedNotes = [
      String(notesMap[row._id] || "").trim(),
      String(attachmentMap[row._id] || "").trim() ? `Attachment: ${attachmentMap[row._id]}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    if (action === "reject") {
      const confirm = window.confirm("Are you sure you want to reject this manual purchase request?");
      if (!confirm) return;
    } else {
      const confirm = window.confirm("Are you sure you want to accept this manual purchase request? This will commit your stock.");
      if (!confirm) return;
    }

    setSavingId(`${row._id}:${action}`);
    try {
      await sellerApi.respondToManualPR(row._id, action, combinedNotes);
      showToast(action === "accept" ? "Request accepted successfully!" : "Request rejected.", "success");
      fetchRows();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to submit response", "error");
    } finally {
      setSavingId("");
    }
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
                      {row.requestType === "manual" ? (
                        <span className="bg-amber-600 text-white px-2 py-0.5 rounded text-[10px] sm:text-xs uppercase tracking-tighter font-bold animate-pulse">Manual</span>
                      ) : (
                        <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px] sm:text-xs uppercase tracking-tighter font-bold">Automated</span>
                      )}
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
                    <Badge variant={statusVariant(row.status)} className="font-black text-[10px] sm:text-xs uppercase">{row.status.replace('_', ' ')}</Badge>
                    {row.status === "created" && row.expiresAt && (
                      <PRCountdown expiresAt={row.expiresAt} status={row.status} onExpired={fetchRows} />
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-3">
                  {(row.items || []).map((item) => {
                    const key = lineKey(item);
                    const requestedQty = Number(item.requestedQty ?? item.shortageQty ?? item.requiredQty ?? 0);
                    const lineStatus = normalizeStatus(item.lineStatus || "pending");
                    const lineRespondable = canRespondLine(row, item);

                    return (
                    <div
                      key={`${row._id}-${key}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start">
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
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black text-slate-900">{item.productName}</p>
                            <Badge variant={lineStatus === "accepted" ? "success" : lineStatus === "rejected" ? "error" : lineStatus === "partial" ? "warning" : "gray"}>
                              {lineStatus}
                            </Badge>
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:flex sm:flex-wrap text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                            <span>Requested: <span className="text-indigo-600">{requestedQty} {item.unit}</span></span>
                            <span>Committed: <span className="text-emerald-600">{item.committedQty || 0}</span></span>
                            <span>Remaining: <span className="text-rose-500">{item.remainingQty ?? 0}</span></span>
                            <span>Rate: <span className="text-emerald-600">₹{item.unitCost}</span></span>
                          </div>
                          {lineRespondable && (
                            <div className="mt-3 flex flex-wrap items-end gap-2">
                              <div className="w-full sm:w-28">
                                <Input
                                  label="Accept Qty"
                                  value={commitMap[row._id]?.[key] ?? String(requestedQty)}
                                  onChange={(e) => {
                                    if (!ALLOW_SELLER_EDIT_ACCEPT_QTY) return;
                                    setCommitMap((prev) => ({
                                      ...prev,
                                      [row._id]: {
                                        ...(prev[row._id] || {}),
                                        [key]: e.target.value.replace(/\D/g, ""),
                                      },
                                    }));
                                  }}
                                  placeholder="Qty"
                                  readOnly={!ALLOW_SELLER_EDIT_ACCEPT_QTY}
                                  disabled={!ALLOW_SELLER_EDIT_ACCEPT_QTY}
                                  className={
                                    !ALLOW_SELLER_EDIT_ACCEPT_QTY
                                      ? "bg-slate-50 text-slate-600 cursor-not-allowed"
                                      : undefined
                                  }
                                  title={
                                    !ALLOW_SELLER_EDIT_ACCEPT_QTY
                                      ? "Quantity is fixed to the requested amount"
                                      : undefined
                                  }
                                />
                              </div>
                              <Button
                                size="sm"
                                onClick={() =>
                                  isVerified ? acceptLine(row, item) : showToast("Account pending approval", "error")
                                }
                                isLoading={savingId === `${row._id}:${key}:accept`}
                                disabled={!lineRespondable || !isVerified}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() =>
                                  isVerified ? rejectLine(row, item) : showToast("Account pending approval", "error")
                                }
                                isLoading={savingId === `${row._id}:${key}:reject`}
                                disabled={!lineRespondable || !isVerified}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>

                {row.requestType === "manual" ? (
                  row.status === "created" && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleRespondManual(row, "reject")}
                        isLoading={savingId === `${row._id}:reject`}
                        disabled={savingId !== ""}
                      >
                        Reject Request
                      </Button>
                      <Button
                        onClick={() => handleRespondManual(row, "accept")}
                        isLoading={savingId === `${row._id}:accept`}
                        disabled={savingId !== ""}
                      >
                        Accept & Commit
                      </Button>
                    </div>
                  )
                ) : (
                  <>
                    {(row.items || []).length === 1 && (
                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        <Button
                          onClick={() =>
                            isVerified ? commitQuantities(row) : showToast("Account pending approval", "error")
                          }
                          isLoading={savingId === `${row._id}:commit`}
                          disabled={!canRespondLine(row, row.items[0]) || !isVerified}
                        >
                          Accept All
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
                    )}

                    {(row.items || []).length > 1 && (
                      <div className="mt-4">
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
                    )}
                  </>
                )}

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
                </div>

                {/* Seller never verifies Pickup OTP — only reads status + OTP aloud */}
                {row.pickupAssigned || row.pickupPartner?.name ? (
                  <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 space-y-2">
                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-indigo-600">
                      Pickup Partner Assigned
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {row.pickupPartner?.name || row.pickupPartnerName || "Pickup Partner"}
                    </p>
                    <p className="text-xs font-semibold text-slate-600">
                      {row.pickupStatusLabel ||
                        (row.status === "pickup_assigned"
                          ? "Waiting For Pickup"
                          : row.status?.replace(/_/g, " "))}
                    </p>
                    {row.status === "pickup_assigned" && row.pickupOtp ? (
                      <div className="rounded-lg bg-white px-3 py-2 border border-indigo-100">
                        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">
                          Tell this OTP to Pickup Partner
                        </p>
                        <p className="text-xl sm:text-2xl font-black tracking-[0.2em] sm:tracking-[0.35em] text-slate-900">
                          {row.pickupOtp}
                        </p>
                      </div>
                    ) : row.status === "pickup_assigned" ? (
                      <p className="text-xs font-semibold text-amber-700">
                        Waiting for pickup partner to generate OTP…
                      </p>
                    ) : null}
                    <p className="text-[10px] font-semibold text-slate-400">
                      Phone hidden · Masked calling coming soon
                    </p>
                  </div>
                ) : null}

                {row.timeline?.length > 0 && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">
                      Pickup Status Timeline
                    </p>
                    <PurchaseRequestTimeline timeline={row.timeline} compact />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProcurementRequests;
