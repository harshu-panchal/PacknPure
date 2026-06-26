import React, { useMemo } from "react";
import Badge from "@shared/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  HiOutlineClipboardDocumentList,
  HiOutlineTruck,
  HiOutlineClock,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import { formatPrDate, formatInr } from "@shared/utils/purchaseRequestFormat";

const phaseBadgeVariant = (phase) => {
  if (phase === "in_delivery") return "info";
  if (phase === "awaiting_vendor") return "warning";
  if (phase === "at_hub") return "primary";
  if (phase === "exception") return "error";
  if (phase === "completed") return "success";
  return "gray";
};

const PurchaseRequestListPanel = ({
  requests = [],
  loading = false,
  title = "Purchase requests",
  emptyMessage = "No purchase requests yet.",
  showProductColumn = true,
  compact = false,
}) => {
  const { openRequests, completedRequests } = useMemo(() => {
    const list = Array.isArray(requests) ? requests : [];
    const isOpenRow = (r) =>
      r.isOpen === true ||
      (r.isOpen !== false &&
        !["verified", "closed", "cancelled"].includes(String(r.status || "")));
    const open = list.filter(isOpenRow);
    const done = list.filter((r) => !isOpenRow(r));
    return { openRequests: open, completedRequests: done };
  }, [requests]);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        Loading purchase requests…
      </div>
    );
  }

  if (!requests.length) {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-500 text-center">
        {emptyMessage}
      </div>
    );
  }

  const renderRow = (pr) => (
    <tr key={pr._id || pr.requestId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
      <td className="px-3 py-3 align-top">
        <p className="text-xs font-black text-slate-900">{pr.requestId}</p>
        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
          <HiOutlineClock className="h-3 w-3" />
          Requested {formatPrDate(pr.createdAt)}
        </p>
        {(pr.confirmedAt || pr.dates?.confirmedAt) && (
          <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
            <HiOutlineCheckCircle className="h-3 w-3" />
            Confirmed {formatPrDate(pr.confirmedAt || pr.dates?.confirmedAt)}
          </p>
        )}
      </td>
      {showProductColumn && (
        <td className="px-3 py-3 align-top">
          <p className="text-xs font-semibold text-slate-800">{pr.product || pr.productName || "—"}</p>
          {pr.items?.length > 1 && (
            <p className="text-[10px] text-slate-400">+{pr.items.length - 1} more item(s)</p>
          )}
        </td>
      )}
      <td className="px-3 py-3 align-top">
        <Badge variant={phaseBadgeVariant(pr.phase)} className="text-[9px] uppercase">
          {pr.statusLabel || pr.status}
        </Badge>
        {pr.vendorResponse && pr.vendorResponse !== "pending" && (
          <p className="text-[10px] text-slate-500 mt-1 capitalize">Vendor: {pr.vendorResponse}</p>
        )}
      </td>
      <td className="px-3 py-3 align-top text-xs font-bold text-slate-800">
        {pr.quantity ?? "—"}
      </td>
      <td className="px-3 py-3 align-top text-xs text-slate-700">
        ₹{Number(pr.unitCost || 0).toLocaleString("en-IN")}
      </td>
      <td className="px-3 py-3 align-top">
        <p className="text-xs font-bold text-emerald-700">
          ₹{formatInr(pr.totalCost || (pr.unitCost || 0) * (pr.quantity || 0))}
        </p>
        {(pr.gstTotal ?? pr.gstAmount) > 0 && (
          <p className="text-[10px] text-slate-400">incl. GST ₹{formatInr(pr.gstTotal ?? pr.gstAmount)}</p>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        {pr.phase === "in_delivery" && (pr.pickupPartner?.name || pr.pickupPartnerName) ? (
          <p className="text-[10px] font-medium text-sky-800 flex items-start gap-1">
            <HiOutlineTruck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              {pr.pickupPartner?.name || pr.pickupPartnerName}
              {pr.pickupPartner?.phone || pr.pickupPartnerPhone
                ? ` · ${pr.pickupPartner?.phone || pr.pickupPartnerPhone}`
                : ""}
            </span>
          </p>
        ) : (
          <span className="text-[10px] text-slate-400">—</span>
        )}
        {pr.notes ? (
          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2" title={pr.notes}>
            Note: {pr.notes}
          </p>
        ) : null}
      </td>
    </tr>
  );

  const table = (rows) => (
    <div className="overflow-x-auto rounded-xl ring-1 ring-slate-100">
      <table className="w-full text-left min-w-[640px]">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <th className="px-3 py-2">PR ID</th>
            {showProductColumn && <th className="px-3 py-2">Product</th>}
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Unit ₹</th>
            <th className="px-3 py-2">Total ₹</th>
            <th className="px-3 py-2">Delivery</th>
          </tr>
        </thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
          <HiOutlineClipboardDocumentList className="h-4 w-4" />
          {title} ({requests.length})
        </p>
        {table(requests)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {openRequests.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-2">
            <HiOutlineClipboardDocumentList className="h-4 w-4" />
            Active / in progress ({openRequests.length})
          </p>
          {table(openRequests)}
        </div>
      )}
      {completedRequests.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Recently completed ({completedRequests.length})
          </p>
          <div className={cn(openRequests.length > 0 && "opacity-80")}>
            {table(completedRequests)}
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseRequestListPanel;
