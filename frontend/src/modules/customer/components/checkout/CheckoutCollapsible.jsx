import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Simple accordion row for checkout order summary (coupons, payment).
 */
export default function CheckoutCollapsible({
  title,
  subtitle,
  icon: Icon,
  open,
  onToggle,
  children,
}) {
  return (
    <div className="border-t border-slate-100">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 py-3 text-left"
        aria-expanded={open}
      >
        {Icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon size={18} />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          {subtitle ? (
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "shrink-0 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? <div className="space-y-2 pb-3">{children}</div> : null}
    </div>
  );
}
