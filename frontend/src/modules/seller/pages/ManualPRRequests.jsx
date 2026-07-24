import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { useAuth } from "@/core/context/AuthContext";
import ManualPRCountdown from "@shared/components/ManualPRCountdown";
import { formatPrDate } from "@shared/utils/purchaseRequestFormat";

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Pending Response", value: "created" },
  { label: "Vendor Confirmed", value: "seller_confirmed" },
  { label: "Pickup Assigned", value: "pickup_assigned" },
  { label: "In Transit", value: "picked" },
  { label: "Hub Delivered", value: "hub_delivered" },
  { label: "Received", value: "received_at_hub" },
  { label: "Verified", value: "verified" },
  { label: "Expired", value: "expired" },
  { label: "Seller Rejected", value: "seller_rejected" },
  { label: "Cancelled", value: "cancelled" },
];

const statusVariant = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "created":
      return "warning";
    case "seller_confirmed":
    case "vendor_confirmed":
      return "info";
    case "pickup_assigned":
      return "primary";
    case "picked":
      return "success";
    case "verified":
    case "closed":
      return "success";
    case "expired":
    case "seller_rejected":
    case "cancelled":
    case "seller_failed":
      return "error";
    default:
      return "gray";
  }
};

const statusLabelText = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "created") return "Pending Vendor";
  if (s === "seller_confirmed" || s === "vendor_confirmed") return "Confirmed";
  if (s === "pickup_assigned") return "Pickup Assigned";
  if (s === "picked") return "In Transit";
  if (s === "hub_delivered") return "Hub Gate Inward";
  if (s === "received_at_hub") return "Received";
  if (s === "verified") return "Verified (QA Passed)";
  if (s === "expired") return "Expired";
  if (s === "seller_rejected") return "Rejected";
  if (s === "cancelled") return "Cancelled";
  if (s === "seller_failed") return "Pickup Failed";
  return s.toUpperCase();
};

export const ManualPRRequests = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [actioningId, setActioningId] = useState(null);

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await sellerApi.getPurchaseRequests({});
      const list = res?.data?.result?.items || [];
      // Filter out only standalone manual requests (no orderId)
      const manualOnly = list.filter((r) => !r.orderId);
      setRows(manualOnly);
    } catch (error) {
      toast.error("Failed to load manual requests list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    const interval = setInterval(fetchRows, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRespond = async (id, action) => {
    let reason = "";
    if (action === "reject") {
      const resReason = window.prompt("Enter rejection reason (optional):");
      if (resReason === null) return; // User cancelled prompt
      reason = resReason.trim();
    } else {
      const confirm = window.confirm("Are you sure you want to accept this purchase request? This will commit your stock.");
      if (!confirm) return;
    }

    setActioningId(id);
    const toastId = toast.loading(action === "accept" ? "Accepting request..." : "Rejecting request...");
    try {
      await sellerApi.respondToManualPR(id, action, reason);
      toast.success(action === "accept" ? "Request accepted successfully!" : "Request rejected.", { id: toastId });
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit response", { id: toastId });
    } finally {
      setActioningId(null);
    }
  };

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => {
      const st = String(r.status).toLowerCase();
      const filter = String(statusFilter).toLowerCase();
      if (filter === "vendor_confirmed") {
        return st === "seller_confirmed" || st === "vendor_confirmed";
      }
      return st === filter;
    });
  }, [rows, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Manual Purchase Requests</h1>
          <p className="text-xs text-slate-500 mt-1">
            Accept or reject standalone manual procurement requests from administration
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase mr-1">Filter</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 text-xs font-bold rounded-xl border border-slate-200 px-3 outline-none focus:border-indigo-400"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4" />
          Loading manual requests...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm border border-dashed border-slate-250 bg-slate-50 rounded-2xl">
          No manual purchase requests found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredRows.map((row) => {
            const isCreated = row.status === "created";
            const items = row.items || [];
            const isActioning = actioningId === row._id;

            return (
              <Card key={row._id} className="p-5 border border-slate-100 shadow-sm relative overflow-hidden bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-black text-slate-900">{row.requestId}</span>
                      <Badge variant={statusVariant(row.status)} className="text-[10px] uppercase font-black">
                        {statusLabelText(row.status)}
                      </Badge>
                      {isCreated && row.expiresAt && (
                        <ManualPRCountdown expiresAt={row.expiresAt} status={row.status} />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-450 mt-1">
                      Received: {formatPrDate(row.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-indigo-600">₹{row.totalCost?.toFixed(2) || "0.00"}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{items.length} Product(s)</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requested Products</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 text-[10px] border-b border-slate-100 font-bold uppercase">
                          <th className="pb-1.5 font-bold">Item</th>
                          <th className="pb-1.5 text-right font-bold">Qty</th>
                          <th className="pb-1.5 text-right font-bold">Unit Cost</th>
                          <th className="pb-1.5 text-right font-bold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {items.map((item, idx) => (
                          <tr key={item._id || idx} className="text-slate-700">
                            <td className="py-1.5 font-medium">
                              {item.productName || "Product"} {item.variantName ? `(${item.variantName})` : ""}
                            </td>
                            <td className="py-1.5 text-right font-mono font-bold text-slate-800">{item.requestedQty}</td>
                            <td className="py-1.5 text-right">₹{item.vendorUnitCost?.toFixed(2) || "0.00"}</td>
                            <td className="py-1.5 text-right font-semibold text-slate-800">₹{item.totalProcurementCost?.toFixed(2) || "0.00"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {row.notes && (
                  <div className="mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Admin Request Notes</p>
                    <p className="text-xs text-slate-600 italic">"{row.notes}"</p>
                  </div>
                )}

                {isCreated && (
                  <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      disabled={isActioning}
                      onClick={() => handleRespond(row._id, "reject")}
                      className="px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all disabled:opacity-50"
                    >
                      Reject Request
                    </button>
                    <button
                      type="button"
                      disabled={isActioning}
                      onClick={() => handleRespond(row._id, "accept")}
                      className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-150 disabled:opacity-50"
                    >
                      Accept & Commit
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ManualPRRequests;
