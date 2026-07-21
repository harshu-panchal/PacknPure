import React from "react";
import Modal from "@shared/components/ui/Modal";
import Badge from "@shared/components/ui/Badge";
import PurchaseRequestTimeline from "@shared/components/PurchaseRequestTimeline";
import { formatInr, formatPrDate, prStatusLabel } from "@shared/utils/purchaseRequestFormat";
import PurchaseRequestLineItems from "./PurchaseRequestLineItems";

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

const PurchaseRequestDetailModal = ({ isOpen, onClose, row, loading = false }) => {
  if (!isOpen) return null;

  const dates = row?.dates || {};
  const items = row?.items || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={row?.requestId ? `Purchase request · ${row.requestId}` : "Purchase request"}
      size="xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
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
              <Badge variant="primary" className="text-[10px] uppercase mb-2">
                {row.statusLabel || prStatusLabel(row.status)}
              </Badge>
              <p className="text-lg font-bold text-slate-900">{row.vendorName || "Vendor"}</p>
              {row.vendorPhone ? (
                <p className="text-sm text-slate-500">{row.vendorPhone}</p>
              ) : null}
            </div>
            <div className="text-right text-sm text-slate-600">
              <p>
                <span className="text-slate-400">Requested:</span>{" "}
                {formatPrDate(dates.requestedAt || row.createdAt)}
              </p>
              {dates.confirmedAt ? (
                <p>
                  <span className="text-slate-400">Confirmed:</span>{" "}
                  {formatPrDate(dates.confirmedAt)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Subtotal", value: `₹${formatInr(row.subtotal ?? row.unitCost * row.quantity)}` },
              { label: "GST", value: `₹${formatInr(row.gstTotal ?? row.gstAmount)}` },
              { label: "Grand total", value: `₹${formatInr(row.totalCost)}`, highlight: true },
              {
                label: "Total qty",
                value: items.length ? totalRequestedQty(items) : row.quantity,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-white border border-slate-100 p-3"
              >
                <p className="text-[10px] font-semibold uppercase text-slate-400">{stat.label}</p>
                <p
                  className={
                    stat.highlight
                      ? "text-lg font-bold text-emerald-700"
                      : "text-base font-bold text-slate-900"
                  }
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <Section title="Line items">
            {items.length > 0 ? (
              <PurchaseRequestLineItems items={items} showStatus />
            ) : null}
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-200">
                    <th className="pb-2 pr-3">Product</th>
                    <th className="pb-2 pr-3">Variant</th>
                    <th className="pb-2 pr-3">Requested</th>
                    <th className="pb-2 pr-3">Accepted</th>
                    <th className="pb-2 pr-3">Remaining</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Unit cost</th>
                    <th className="pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.itemKey || item.productId || i} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-slate-800">
                        {item.productName || row.product}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500 text-xs">
                        {item.variantId ? String(item.variantId).slice(-8) : "—"}
                      </td>
                      <td className="py-2.5 pr-3">{requestedQty(item)}</td>
                      <td className="py-2.5 pr-3">{Number(item.committedQty || 0)}</td>
                      <td className="py-2.5 pr-3">{Number(item.remainingQty ?? 0)}</td>
                      <td className="py-2.5 pr-3 capitalize text-xs">
                        {lineStatusLabel(item.lineStatus)}
                      </td>
                      <td className="py-2.5 pr-3">₹{formatInr(item.unitCost)}</td>
                      <td className="py-2.5 font-semibold">₹{formatInr(item.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="grid md:grid-cols-2 gap-4">
            <Section title="Key dates">
              <dl className="space-y-2 text-sm">
                {[
                  ["Requested", dates.requestedAt || row.createdAt],
                  ["Vendor confirmed", dates.confirmedAt],
                  ["Ready for pickup", dates.vendorReadyAt],
                  ["Pickup assigned", dates.pickupAssignedAt],
                  ["Picked up", dates.pickedAt],
                  ["Hub delivery", dates.hubDeliveredAt],
                  ["Received at hub", dates.receivedAtHub],
                  ["Verified", dates.verifiedAt],
                  ["ETA", dates.eta],
                ].map(([label, val]) =>
                  val ? (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-medium text-slate-800 text-right">{formatPrDate(val)}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </Section>

            <Section title="Request history">
              <PurchaseRequestTimeline timeline={row.timeline} compact />
            </Section>
          </div>

          {(row.notes || row.exceptionReason || row.pickupPartnerName) && (
            <Section title="Notes & logistics">
              {row.pickupPartnerName ? (
                <p className="text-sm text-slate-700 mb-2">
                  Pickup: <strong>{row.pickupPartnerName}</strong>
                  {row.pickupPartnerPhone ? ` · ${row.pickupPartnerPhone}` : ""}
                </p>
              ) : null}
              {row.notes ? (
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{row.notes}</p>
              ) : null}
              {row.exceptionReason ? (
                <p className="text-sm text-rose-600 mt-2">{row.exceptionReason}</p>
              ) : null}
            </Section>
          )}
        </div>
      )}
    </Modal>
  );
};

export default PurchaseRequestDetailModal;
