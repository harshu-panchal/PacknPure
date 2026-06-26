import React from "react";
import { cn } from "@/lib/utils";

export const DEFAULT_GST_RATES = [0, 5, 12, 18, 28];

export const variantGstAmount = (variant, taxablePrice) => {
  if (!variant?.gstEnabled) return 0;
  const rate = Number(variant.gstRate) || 0;
  const base = Number(taxablePrice) || 0;
  if (!rate || !base) return 0;
  return Math.round((base * rate) / 100);
};

export const variantGstLabel = (variant) => {
  if (!variant?.gstEnabled || !Number(variant.gstRate)) return "No GST";
  return `GST ${variant.gstRate}%`;
};

/**
 * Per-variant GST toggle + rate selector.
 * taxablePrice: sell price (admin) or supply price (seller) for preview.
 */
const VariantGstFields = ({
  variant = {},
  gstRates = DEFAULT_GST_RATES,
  taxablePrice = 0,
  onChange,
  disabled = false,
  compact = false,
  className,
}) => {
  const enabled = Boolean(variant.gstEnabled);
  const rate = Number(variant.gstRate) || 0;
  const gstAmt = variantGstAmount(variant, taxablePrice);

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-3 space-y-2",
        compact && "p-2 space-y-1.5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={cn("font-semibold text-slate-800", compact ? "text-xs" : "text-sm")}>
            GST on this variant
          </p>
          <p className="text-[11px] text-slate-500">
            {enabled ? "Tax applies to the price above" : "No tax on this variant"}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange({
              gstEnabled: !enabled,
              gstRate: !enabled ? rate || gstRates.find((r) => r > 0) || 5 : 0,
            })
          }
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
            enabled ? "bg-emerald-500" : "bg-slate-300",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          aria-pressed={enabled}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>

      {enabled ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[100px]">
            <span className="text-[10px] font-semibold uppercase text-slate-500">GST rate</span>
            <select
              disabled={disabled}
              value={rate}
              onChange={(e) => onChange({ gstRate: Number(e.target.value) || 0 })}
              className="mt-1 w-full h-9 rounded-lg border border-slate-200 px-2 text-sm font-semibold outline-none focus:border-indigo-400"
            >
              {gstRates.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </label>
          {taxablePrice > 0 && rate > 0 ? (
            <>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase text-slate-500">GST amt</p>
                <p className="text-sm font-bold text-amber-700">₹{gstAmt.toLocaleString("en-IN")}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Final cost</p>
                <p className="text-sm font-bold text-indigo-700">₹{(Number(taxablePrice) + gstAmt).toLocaleString("en-IN")}</p>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default VariantGstFields;
