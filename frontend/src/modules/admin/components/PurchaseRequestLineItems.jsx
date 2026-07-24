import React from "react";
import Badge from "@shared/components/ui/Badge";

const lineStatusVariant = (status) => {
  switch (String(status || "pending").toLowerCase()) {
    case "accepted":
      return "success";
    case "partial":
      return "warning";
    case "rejected":
      return "error";
    default:
      return "gray";
  }
};

const formatLineStatus = (status) => {
  const s = String(status || "pending").toLowerCase();
  if (s === "accepted") return "Accepted";
  if (s === "partial") return "Partial";
  if (s === "rejected") return "Rejected";
  return "Pending";
};

const requestedQty = (item) =>
  Number(item?.requestedQty ?? item?.shortageQty ?? item?.requiredQty ?? item?.quantity ?? 0);

/**
 * Compact stacked list of all PR line items (matches seller allocation view).
 */
const PurchaseRequestLineItems = ({
  items = [],
  compact = false,
  showStatus = true,
  maxVisible = null,
}) => {
  const lines = Array.isArray(items) ? items : [];
  if (lines.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const limit =
    maxVisible != null && Number(maxVisible) > 0
      ? Math.min(Number(maxVisible), lines.length)
      : lines.length;
  const visible = lines.slice(0, limit);
  const hiddenCount = lines.length - visible.length;

  const variantLabel = (item) => {
    if (item?.variantName) return String(item.variantName);
    if (item?.variant?.name) return String(item.variant.name);
    return null;
  };

  if (compact) {
    return (
      <ul className="space-y-1 min-w-0">
        {visible.map((item, index) => {
          const vLabel = variantLabel(item);
          return (
            <li
              key={item.itemKey || `${item.productId || "p"}-${item.variantId || index}`}
              className="text-xs text-slate-800 flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
            >
              <span className="font-semibold truncate max-w-[140px]" title={item.productName || "Product"}>
                {item.productName || "Product"}
              </span>
              {vLabel ? (
                <span className="text-slate-400 truncate max-w-[72px]" title={vLabel}>
                  · {vLabel}
                </span>
              ) : null}
              <span className="text-slate-500 tabular-nums">×{requestedQty(item)}</span>
              {showStatus && (
                <Badge variant={lineStatusVariant(item.lineStatus)} className="text-[9px] py-0">
                  {formatLineStatus(item.lineStatus)}
                </Badge>
              )}
            </li>
          );
        })}
        {hiddenCount > 0 ? (
          <li className="text-[10px] font-semibold text-slate-500">+{hiddenCount} more</li>
        ) : null}
      </ul>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((item, index) => {
        const vLabel = variantLabel(item);
        return (
          <div
            key={item.itemKey || `${item.productId || "p"}-${item.variantId || index}`}
            className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {item.productName || "Product"}
                </p>
                {vLabel ? (
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{vLabel}</p>
                ) : null}
              </div>
              {showStatus ? (
                <Badge variant={lineStatusVariant(item.lineStatus)} className="text-[9px] shrink-0">
                  {formatLineStatus(item.lineStatus)}
                </Badge>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-medium text-slate-600">
              <span>
                Requested <span className="text-indigo-700">{requestedQty(item)}</span>
              </span>
              <span>
                Accepted <span className="text-emerald-700">{Number(item.committedQty || 0)}</span>
              </span>
              <span>
                Remaining <span className="text-rose-600">{Number(item.remainingQty ?? 0)}</span>
              </span>
            </div>
          </div>
        );
      })}
      {hiddenCount > 0 ? (
        <p className="text-[10px] font-semibold text-slate-500 px-0.5">+{hiddenCount} more in details</p>
      ) : null}
    </div>
  );
};

export default PurchaseRequestLineItems;
