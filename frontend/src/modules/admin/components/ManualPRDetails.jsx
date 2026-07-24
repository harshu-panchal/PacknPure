import React from "react";
import Modal from "@shared/components/ui/Modal";
import Badge from "@shared/components/ui/Badge";
import ManualPRCountdown from "@shared/components/ManualPRCountdown";
import ManualPRTimeline from "./ManualPRTimeline";
import { formatInr, formatPrDate, prStatusLabel } from "@shared/utils/purchaseRequestFormat";

const lineStatusLabel = (status) => {
  const s = String(status || "pending").toLowerCase();
  if (s === "accepted") return "Accepted";
  if (s === "partial") return "Partial";
  if (s === "rejected") return "Rejected";
  return "Pending";
};

const requestedQty = (item) =>
  Number(item?.requestedQty ?? item?.shortageQty ?? item?.requiredQty ?? item?.quantity ?? 0);

const totalRequestedQty = (items = []) =>
  items.reduce((sum, item) => sum + requestedQty(item), 0);

const Section = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{title}</p>
    {children}
  </div>
);

export const ManualPRDetails = ({ isOpen, onClose, row, loading = false }) => {
  if (!isOpen) return null;

  const dates = row?.dates || {};
  const items = row?.items || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={row?.requestId ? `Manual PR Details · ${row.requestId}` : "Manual Purchase Request"}
      size="xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
        >
          Close
        </button>
      }
    >
      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading request details…</p>
      ) : !row ? (
        <p className="py-12 text-center text-sm text-slate-500">No request selected.</p>
      ) : (
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="primary" className="text-[10px] uppercase">
                  {row.statusLabel || prStatusLabel(row.status)}
                </Badge>
                {row.status === "created" && row.expiresAt && (
                  <ManualPRCountdown expiresAt={row.expiresAt} status={row.status} />
                )}
              </div>
              <p className="text-lg font-bold text-slate-900">{row.vendorName || row.vendorId?.shopName || "Vendor"}</p>
              {row.vendorPhone ? (
                <p className="text-sm text-slate-500">{row.vendorPhone}</p>
              ) : null}
            </div>
            <div className="text-right text-sm text-slate-600">
              <p>
                <span className="text-slate-400 font-medium">Requested:</span>{" "}
                {formatPrDate(dates.requestedAt || row.createdAt)}
              </p>
              {dates.confirmedAt ? (
                <p className="mt-0.5">
                  <span className="text-slate-400 font-medium">Confirmed:</span>{" "}
                  {formatPrDate(dates.confirmedAt)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Subtotal", value: `₹${formatInr(row.subtotal ?? row.totalCost - (row.gstTotal ?? row.gstAmount ?? 0))}` },
              { label: "GST", value: `₹${formatInr(row.gstTotal ?? row.gstAmount)}` },
              { label: "Grand total", value: `₹${formatInr(row.totalCost)}`, highlight: true },
              {
                label: "Total qty",
                value: items.length ? totalRequestedQty(items) : row.quantity,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-white border border-slate-100 p-3 shadow-sm"
              >
                <p className="text-[10px] font-bold uppercase text-slate-400">{stat.label}</p>
                <p
                  className={
                    stat.highlight
                      ? "text-base font-black text-indigo-600"
                      : "text-sm font-bold text-slate-800"
                  }
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <Section title="Requested items">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-200">
                    <th className="pb-2 pr-3">Product Name</th>
                    <th className="pb-2 pr-3">Variant</th>
                    <th className="pb-2 pr-3 text-right">Requested</th>
                    <th className="pb-2 pr-3 text-right">Committed</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3 text-right">Unit cost</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, i) => (
                    <tr key={item.itemKey || item.productId?._id || item.productId || i} className="text-xs">
                      <td className="py-2.5 pr-3 font-semibold text-slate-850">
                        {item.productName || item.productId?.name || row.product || "Product"}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500">
                        {item.variantId?.name || item.variantName || "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono">{requestedQty(item)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono">{Number(item.committedQty || 0)}</td>
                      <td className="py-2.5 pr-3 capitalize">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          lineStatusLabel(item.lineStatus) === "Accepted" ? "text-emerald-700 bg-emerald-50" :
                          lineStatusLabel(item.lineStatus) === "Rejected" ? "text-rose-700 bg-rose-550 bg-rose-550/10" :
                          "text-slate-600 bg-slate-100"
                        }`}>
                          {lineStatusLabel(item.lineStatus)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">₹{formatInr(item.unitCost || item.vendorUnitCost || 0)}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-800">₹{formatInr(item.totalCost || item.totalProcurementCost || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="grid md:grid-cols-2 gap-4">
            <Section title="Timeline & statuses">
              <ManualPRTimeline timeline={row.timeline} createdAt={row.createdAt} dates={dates} />
            </Section>

            <Section title="Notes & logistics">
              {row.pickupPartnerName ? (
                <div className="mb-3 text-xs bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-50">
                  <p className="font-bold text-indigo-900">Pickup Logistics Assigned</p>
                  <p className="text-slate-600 mt-0.5">Partner: <strong>{row.pickupPartnerName}</strong></p>
                  {row.pickupPartnerPhone && <p className="text-slate-500">Phone: {row.pickupPartnerPhone}</p>}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic mb-2">No pickup partner assigned yet.</p>
              )}
              {row.notes ? (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Admin Notes</p>
                  <p className="text-xs text-slate-600 bg-white p-2.5 border border-slate-100 rounded-xl whitespace-pre-wrap">{row.notes}</p>
                </div>
              ) : null}
              {row.exceptionReason ? (
                <div className="mt-3">
                  <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">Status Exception</p>
                  <p className="text-xs text-rose-600 bg-rose-50/50 p-2.5 border border-rose-100 rounded-xl">{row.exceptionReason}</p>
                </div>
              ) : null}
            </Section>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ManualPRDetails;
