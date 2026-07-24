import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileClock, CheckCircle2, Truck, Store, PackageCheck, AlertCircle } from "lucide-react";
import SupplyModuleTable from "../components/supply/SupplyModuleTable";
import {
  SupplyConfirmModal,
  SupplyFormModal,
  SupplyInfoModal,
} from "../components/supply/SupplyActionModals";
import PurchaseRequestDetailModal from "../components/PurchaseRequestDetailModal";
import PurchaseRequestLineItems from "../components/PurchaseRequestLineItems";
import { adminApi } from "../services/adminApi";
import { formatInr, formatPrDate, prStatusLabel } from "@shared/utils/purchaseRequestFormat";
import PRCountdown from "@shared/components/PRCountdown";

const statusToLabel = (value) => prStatusLabel(value);

const PurchaseRequestsPage = () => {
  const [rows, setRows] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [pickupPartners, setPickupPartners] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ pickupPartnerId: "" });
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState({ vendorId: "" });
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  const fetchRows = async () => {
    try {
      const res = await adminApi.getPurchaseRequests({ page: 1, limit: 200 });
      const payload = res?.data?.result || res?.data?.results || {};
      const items = Array.isArray(payload) ? payload : Array.isArray(payload.items) ? payload.items : [];
      setRows(
        items.map((item) => ({
          ...item,
          statusLabel: item.statusLabel || statusToLabel(item.status),
          rawStatus: item.status,
          quantity: Number(item.quantity || 0),
        })),
      );
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    fetchRows();
    (async () => {
      try {
        const res = await adminApi.getSellers({ page: 1, limit: 300 });
        const items = res?.data?.result?.items || res?.data?.result || [];
        setSellers(Array.isArray(items) ? items : []);
      } catch {
        setSellers([]);
      }
    })();
    (async () => {
      try {
        const res = await adminApi.getPickupPartners({ page: 1, limit: 300 });
        const items = res?.data?.result?.items || res?.data?.result || [];
        setPickupPartners(Array.isArray(items) ? items : []);
      } catch {
        setPickupPartners([]);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(fetchRows, 15000);
    return () => clearInterval(timer);
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.rawStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        String(row.requestId || "").toLowerCase().includes(q) ||
        String(row.vendorName || "").toLowerCase().includes(q) ||
        String(row.product || "").toLowerCase().includes(q) ||
        (Array.isArray(row.items) &&
          row.items.some((item) =>
            String(item.productName || "").toLowerCase().includes(q),
          ))
      );
    });
  }, [rows, statusFilter, search]);

  const openDetails = async (row) => {
    setCurrentRow(row);
    setDetailsOpen(true);
    setDetailRow(row);
    setDetailLoading(true);
    try {
      const res = await adminApi.getPurchaseRequestById(row._id);
      const detail = res?.data?.result || res?.data;
      if (detail) setDetailRow(detail);
    } catch {
      toast.error("Could not load full request history");
    } finally {
      setDetailLoading(false);
    }
  };

  const openAssign = (row) => {
    setCurrentRow(row);
    setAssignForm({ pickupPartnerId: pickupPartners[0]?._id || "" });
    setAssignOpen(true);
  };

  const submitAssign = async () => {
    if (!currentRow) return;
    const pickupPartnerId = String(assignForm.pickupPartnerId || "").trim();
    if (!pickupPartnerId) {
      toast.error("Please select a pickup partner.");
      return;
    }
    try {
      const res = await adminApi.assignPurchasePickupPartner(currentRow._id, { pickupPartnerId });
      const otp = res?.data?.result?.pickupOtp;
      setAssignOpen(false);
      setInfoMessage(`Pickup assigned. Share OTP with partner: ${otp || "N/A"}`);
      setInfoOpen(true);
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign partner");
    }
  };

  const openAssignVendor = (row) => {
    setCurrentRow(row);
    setVendorForm({ vendorId: sellers[0]?._id || "" });
    setVendorOpen(true);
  };

  const submitAssignVendor = async () => {
    if (!currentRow?._id) return;
    const vendorId = String(vendorForm.vendorId || "").trim();
    if (!vendorId) {
      toast.error("Select a vendor");
      return;
    }
    try {
      await adminApi.assignPurchaseVendor(currentRow._id, { vendorId });
      const vendorName = sellers.find((s) => s._id === vendorId)?.shopName || vendorId;
      setVendorOpen(false);
      setInfoMessage(`Vendor "${vendorName}" assigned successfully.`);
      setInfoOpen(true);
      fetchRows();
    } catch {
      toast.error("Vendor assignment failed");
    }
  };

  const submitAssignReturn = async () => {
    if (!currentRow?._id) return;
    const pickupPartnerId = String(assignForm.pickupPartnerId || "").trim();
    if (!pickupPartnerId) {
      toast.error("Please select a partner for the return trip.");
      return;
    }
    try {
      await adminApi.assignReturnPickup(currentRow._id, { pickupPartnerId });
      setAssignOpen(false);
      setInfoMessage(`Return Assigned. Partner will pick up items from Hub and return to seller.`);
      setInfoOpen(true);
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign return partner");
    }
  };

  const markReceivedAtHub = async (row) => {
    const loadingToast = toast.loading("Processing hub inward...");
    try {
      await adminApi.receivePurchaseRequestAtHub(row._id, { items: [] });
      toast.success(`Received at hub · ${row.requestId}`, { id: loadingToast });
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || "Inward failed", { id: loadingToast });
    }
  };

  const markVerified = async (row) => {
    const loadingToast = toast.loading("Verifying and updating stock...");
    try {
      await adminApi.verifyPurchaseRequestInward(row._id, { verified: true });
      toast.success(`Verified & stocked · ${row.product || row.requestId}`, { id: loadingToast });
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || "Verification failed", { id: loadingToast });
    }
  };

  const rejectQA = async (row) => {
    const reason = window.prompt("Enter reason for QA Rejection (e.g. Damaged, Expired):");
    if (!reason) return;
    const loadingToast = toast.loading("Rejecting QA...");
    try {
      await adminApi.verifyPurchaseRequestInward(row._id, { verified: false, notes: reason });
      toast.success(`QA Rejected. Item moved to return logistics.`, { id: loadingToast });
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || "Rejection failed", { id: loadingToast });
    }
  };

  const stats = useMemo(() => {
    const open = rows.filter((r) => !["verified", "closed", "cancelled"].includes(r.rawStatus));
    return [
      { label: "Total requests", value: String(rows.length) },
      { label: "Awaiting vendor", value: String(rows.filter((r) => r.rawStatus === "created").length) },
      { label: "In transit", value: String(rows.filter((r) => ["pickup_assigned", "picked", "hub_delivered"].includes(r.rawStatus)).length) },
      { label: "Stocked", value: String(rows.filter((r) => r.rawStatus === "verified").length) },
      { label: "Open pipeline", value: String(open.length) },
    ];
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <FileClock size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Purchase requests</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Track procurement from vendor confirmation through hub stocking
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, vendor, product…"
              className="h-10 min-w-[200px] rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400"
            >
              <option value="all">All statuses</option>
              <option value="created">Pending vendor</option>
              <option value="vendor_confirmed">Vendor confirmed</option>
              <option value="pickup_assigned">Pickup assigned</option>
              <option value="picked">In transit</option>
              <option value="hub_delivered">At hub gate</option>
              <option value="received_at_hub">Received at hub</option>
              <option value="verified">Verified</option>
              <option value="expired">Expired</option>
              <option value="seller_rejected">Seller Rejected</option>
              <option value="exception">Exception</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <SupplyModuleTable
        title="Operational timeline"
        subtitle={`${filteredRows.length} request(s) · auto-refresh every 15s`}
        icon={FileClock}
        stats={stats}
        rowKey="_id"
        columns={[
          {
            key: "requestId",
            label: "Request",
            render: (row) => (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-sm font-bold text-slate-900">{row.requestId}</p>
                  {row.requestType === "manual" ? (
                    <span className="bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-tight">Manual</span>
                  ) : (
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-tight">Automated</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{formatPrDate(row.createdAt)}</p>
              </div>
            ),
          },
          {
            key: "vendorName",
            label: "Vendor",
            render: (row) => (
              <div>
                <p className="text-sm font-semibold text-slate-800">{row.vendorName}</p>
                {row.confirmedAt || row.dates?.confirmedAt ? (
                  <p className="text-xs text-emerald-600">
                    Confirmed {formatPrDate(row.confirmedAt || row.dates?.confirmedAt)}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600">Awaiting confirm</p>
                )}
              </div>
            ),
          },
          {
            key: "product",
            label: "Products",
            render: (row) => (
              <PurchaseRequestLineItems
                items={row.items}
                compact={Array.isArray(row.items) && row.items.length <= 2}
                showStatus
              />
            ),
          },
          {
            key: "unitCost",
            label: "Pricing",
            render: (row) => (
              <div className="text-sm">
                <p className="font-semibold text-slate-800">
                  Total ₹{formatInr(row.totalCost)}
                </p>
                <p className="text-xs text-slate-500">
                  {(row.items || []).length} product{(row.items || []).length === 1 ? "" : "s"}
                  {" · "}GST ₹{formatInr(row.gstTotal ?? row.gstAmount)}
                </p>
              </div>
            ),
          },
          {
            key: "pickupPartnerName",
            label: "Pickup",
            render: (row) =>
              row.pickupPartnerName ? (
                <div className="text-sm">
                  <p className="font-medium text-slate-800">{row.pickupPartnerName}</p>
                  {row.dates?.pickupAssignedAt ? (
                    <p className="text-xs text-slate-500">{formatPrDate(row.dates.pickupAssignedAt)}</p>
                  ) : null}
                </div>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              ),
          },
          {
            key: "expiresAt",
            label: "Time Remaining",
            render: (row) => {
              if (row.rawStatus === "created" && row.expiresAt) {
                return <PRCountdown expiresAt={row.expiresAt} status={row.rawStatus} />;
              }
              return <span className="text-slate-400 text-xs">—</span>;
            },
          },
          { key: "statusLabel", label: "Stage" },
        ]}
        rows={filteredRows}
        statusColumn="statusLabel"
        renderActions={(row) => {
          const st = row.rawStatus;
          const isTerminal = ["verified", "closed", "cancelled"].includes(st);
          const needsVendor = !row.vendorId && !isTerminal;
          const needsPickup = (st === "created" || st === "vendor_confirmed") && row.vendorId;
          const needsReceive = ["pickup_assigned", "picked", "hub_delivered"].includes(st);
          const needsFinalVerify = st === "received_at_hub";

          return (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {needsVendor && (
                <button
                  type="button"
                  onClick={() => openAssignVendor(row)}
                  className="inline-flex items-center gap-1.5 bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-amber-600"
                >
                  <Store size={14} /> Assign vendor
                </button>
              )}
              {needsPickup && (
                <button
                  type="button"
                  onClick={() => openAssign(row)}
                  className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700"
                >
                  <Truck size={14} /> Assign pickup
                </button>
              )}
              {needsReceive && (
                <button
                  type="button"
                  onClick={() => markReceivedAtHub(row)}
                  className="inline-flex items-center gap-1.5 bg-sky-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-sky-700"
                >
                  <PackageCheck size={14} /> Receive
                </button>
              )}
              {st === "return_requested" && (
                <button
                  type="button"
                  onClick={() => openAssign(row)}
                  className="inline-flex items-center gap-1.5 bg-purple-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-purple-700"
                >
                  <Truck size={14} /> Assign Return Trip
                </button>
              )}

              {needsFinalVerify && (
                <>
                  <button
                    type="button"
                    onClick={() => markVerified(row)}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={14} /> Verify QA
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectQA(row)}
                    className="inline-flex items-center gap-1.5 bg-rose-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-rose-700"
                  >
                    <AlertCircle size={14} /> Reject QA
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => openDetails(row)}
                className="border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50"
              >
                Details & history
              </button>
              {!isTerminal && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentRow(row);
                    setCancelOpen(true);
                  }}
                  className="p-2 text-slate-400 hover:text-rose-500"
                  title="Cancel request"
                >
                  <AlertCircle size={16} />
                </button>
              )}
            </div>
          );
        }}
      />

      <SupplyFormModal
        isOpen={vendorOpen}
        onClose={() => setVendorOpen(false)}
        title="Assign vendor"
        submitLabel="Confirm"
        fields={[
          {
            key: "vendorId",
            label: "Vendor",
            type: "select",
            options: [
              { value: "", label: "Select vendor…" },
              ...sellers.map((s) => ({
                value: s._id,
                label: `${s.shopName || s.name} (${s.email})`,
              })),
            ],
          },
        ]}
        values={vendorForm}
        onChange={(k, v) => setVendorForm((prev) => ({ ...prev, [k]: v }))}
        onSubmit={submitAssignVendor}
      />

      <SupplyFormModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign pickup partner"
        submitLabel="Assign"
        fields={[
          {
            key: "pickupPartnerId",
            label: "Partner",
            type: "select",
            options: [
              { value: "", label: "Select partner…" },
              ...pickupPartners.map((p) => ({
                value: p._id,
                label: `${p.partnerName || p.name} · ${p.phone}`,
              })),
            ],
          },
        ]}
        values={assignForm}
        onChange={(k, v) => setAssignForm(prev => ({ ...prev, [k]: v }))}
        onSubmit={currentRow?.rawStatus === "return_requested" ? submitAssignReturn : submitAssign}
      />

      <SupplyConfirmModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel request"
        message={`Cancel ${currentRow?.requestId}? This stops the inward pipeline.`}
        confirmLabel="Yes, cancel"
        onConfirm={async () => {
          await adminApi.updatePurchaseRequestStatus(currentRow._id, "cancelled");
          setCancelOpen(false);
          fetchRows();
        }}
      />

      <SupplyInfoModal
        isOpen={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Status"
        message={infoMessage}
      />

      <PurchaseRequestDetailModal
        isOpen={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setDetailRow(null);
        }}
        row={detailRow}
        loading={detailLoading}
      />
    </div>
  );
};

export default PurchaseRequestsPage;
