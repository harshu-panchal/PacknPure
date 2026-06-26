import React from "react";
import { cn } from "@/lib/utils";

const statusTone = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  available: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  healthy: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "low stock": "bg-amber-50 text-amber-700 ring-amber-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  assigned: "bg-sky-50 text-sky-700 ring-sky-200",
  "in transit": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

const getTone = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return statusTone[key] || "bg-slate-100 text-slate-700 ring-slate-200";
};

const StatusPill = ({ value }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1",
      getTone(value),
    )}>
    {value}
  </span>
);

const SupplyModuleTable = ({
  title,
  subtitle,
  icon: Icon,
  topActions = [],
  stats = [],
  columns = [],
  rows = [],
  rowKey = "id",
  statusColumn,
  renderActions,
}) => {
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]">
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              Quick Commerce Control
            </div>
            <h1 className="mt-3 text-xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {topActions.map((action) => (
              <button
                key={typeof action === "string" ? action : action.label}
                type="button"
                onClick={typeof action === "string" ? undefined : action.onClick}
                className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100">
                {typeof action === "string" ? action : action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {stats.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">{stat.label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {column.label}
                  </th>
                ))}
                {renderActions ? (
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (renderActions ? 1 : 0)}
                    className="px-4 py-8 text-center text-sm font-medium text-slate-500">
                    No records found.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row[rowKey] || row.id || idx} className="hover:bg-slate-50/70 transition align-top">
                    {columns.map((column) => {
                      const value = row[column.key];
                      return (
                        <td key={column.key} className="px-4 py-3.5 text-sm text-slate-700 align-top">
                          {column.render ? column.render(row) : (statusColumn === column.key ? <StatusPill value={value} /> : value)}
                        </td>
                      );
                    })}
                    {renderActions ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">{renderActions(row)}</div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SupplyModuleTable;
