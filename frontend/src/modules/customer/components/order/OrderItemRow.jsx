import React from "react";
import { Package } from "lucide-react";
import { resolveOrderItemVariantLabel } from "@/shared/utils/orderItemDisplay";

function formatInr(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

const OrderItemRow = ({ item }) => {
  const variantLabel = resolveOrderItemVariantLabel(item);
  const img = item.image || item.product?.mainImage;
  const lineTotal = Number(item.price) * Number(item.quantity);

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
        {img ? (
          <img src={img} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package size={20} className="text-slate-300" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.name}</p>

        {variantLabel ? (
          <span className="mt-1 inline-flex max-w-full items-center rounded-md bg-[#E23744]/10 px-2 py-0.5 text-[11px] font-semibold text-[#E23744]">
            {variantLabel}
          </span>
        ) : null}

        <p className="mt-1 text-xs text-slate-500">
          Qty {item.quantity}
          <span className="mx-1 text-slate-300">·</span>
          {formatInr(item.price)} each
        </p>
      </div>

      <p className="shrink-0 text-sm font-bold text-slate-900">{formatInr(lineTotal)}</p>
    </li>
  );
};

export default OrderItemRow;
