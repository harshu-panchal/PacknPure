import React, { useEffect, useMemo, useState } from "react";
import { Truck } from "lucide-react";
import SupplyModuleTable from "../components/supply/SupplyModuleTable";
import {
  SupplyConfirmModal,
  SupplyFormModal,
  SupplyInfoModal,
} from "../components/supply/SupplyActionModals";
import { adminApi } from "../services/adminApi";

const PickupPartnersPage = () => {
  const [rows, setRows] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);
  const [addForm, setAddForm] = useState({
    partnerName: "",
    phone: "",
    vehicleType: "bike",
    paymentType: "per_trip",
    salaryAmount: 0,
    perKmRate: 10,
    baseTripRate: 20,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});

  const fetchPartners = async () => {
    try {
      const res = await adminApi.getPickupPartners({ page: 1, limit: 200 });
      const payload = res?.data?.result || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      setRows(
        items.map((item) => ({
          ...item,
          id: item._id,
          status: item.status || "Available",
          assignedPickups: Number(item.assignedPickups || 0),
        })),
      );
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const submitAdd = async () => {
    const partnerName = addForm.partnerName.trim();
    if (!partnerName) return;
    if (!addForm.phone.trim()) return;

    await adminApi.createPickupPartner({
      ...addForm,
    });

    setAddForm({ 
      partnerName: "", phone: "", vehicleType: "bike", 
      paymentType: "per_trip", salaryAmount: 0, perKmRate: 10, baseTripRate: 20 
    });
    setAddOpen(false);
    await fetchPartners();
  };

  const openEdit = (row) => {
    setCurrentRow(row);
    setEditForm({
      partnerName: row.partnerName,
      phone: row.phone,
      vehicleType: row.vehicleType,
      paymentType: row.paymentType,
      salaryAmount: row.salaryAmount,
      perKmRate: row.perKmRate,
      baseTripRate: row.baseTripRate,
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!currentRow) return;
    await adminApi.updatePickupPartner(currentRow.id, editForm);
    setEditOpen(false);
    await fetchPartners();
  };

  const openStatus = (row) => {
    setCurrentRow(row);
    setStatusOpen(true);
  };

  const confirmStatus = async () => {
    if (!currentRow) return;
    const next =
      String(currentRow.status || "").toLowerCase() === "inactive"
        ? "available"
        : "inactive";
    await adminApi.updatePickupPartner(currentRow.id, { status: next });
    setStatusOpen(false);
    await fetchPartners();
  };

  const openTrack = (row) => {
    setCurrentRow(row);
    setTrackOpen(true);
  };

  const stats = useMemo(() => {
    const active = rows.filter((item) => item.status === "Active").length;
    const assigned = rows.reduce(
      (sum, item) => sum + Number(item.assignedPickups || 0),
      0,
    );

    return [
      { label: "Total Partners", value: String(rows.length) },
      { label: "Active Shift", value: String(active) },
      { label: "Assigned Pickups", value: String(assigned) },
      {
        label: "Avg Pickup Load",
        value: rows.length ? (assigned / rows.length).toFixed(1) : "0.0",
      },
    ];
  }, [rows]);

  return (
    <>
      <SupplyModuleTable
        title="Pickup Partners"
        subtitle="Real backend-backed pickup partners for vendor-to-hub procurement movement."
        icon={Truck}
        topActions={[
          {
            label: "Add Pickup Partner",
            onClick: () => {
              setAddForm({ partnerName: "", phone: "", vehicleType: "bike" });
              setAddOpen(true);
            },
          },
          {
            label: "Refresh",
            onClick: fetchPartners,
          },
        ]}
        stats={stats}
        columns={[
          { key: "partnerName", label: "Partner Name" },
          { key: "phone", label: "Phone" },
          { key: "vehicleType", label: "Vehicle" },
          { key: "paymentType", label: "Pay Type" },
          { key: "walletBalance", label: "Wallet", render: (val) => `₹${Number(val || 0).toFixed(2)}` },
          { key: "status", label: "Availability" },
          { key: "isVerified", label: "KYC Status", render: (val) => val ? "✅ Verified" : "⚠️ Pending" },
        ]}
        rows={rows}
        statusColumn="status"
        renderActions={(row) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openEdit(row)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Edit/Pay
            </button>
            <button
              type="button"
              onClick={() => openStatus(row)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              {String(row.status || "").toLowerCase() === "inactive"
                ? "Activate"
                : "Sleep"}
            </button>
            <button
              type="button"
              onClick={async () => {
                await adminApi.updatePickupPartner(row.id, { isVerified: !row.isVerified });
                fetchPartners();
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all shadow-sm ${row.isVerified ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
              {row.isVerified ? "Verified" : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => openTrack(row)}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700">
              Track
            </button>
          </div>
        )}
      />

      <SupplyFormModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Pickup Partner"
        submitLabel="Add"
        fields={[
          { key: "partnerName", label: "Partner Name" },
          { key: "phone", label: "Phone" },
          {
            key: "vehicleType",
            label: "Vehicle Type",
            type: "select",
            options: [
              { value: "bike", label: "Bike" },
              { value: "scooter", label: "Scooter" },
              { value: "van", label: "Van" },
            ],
          },
          {
            key: "paymentType",
            label: "Payment Model",
            type: "select",
            options: [
              { value: "per_trip", label: "Distance/Trip Based" },
              { value: "salary", label: "Fixed Salary" },
            ],
          },
          ...(addForm.paymentType === "salary" 
            ? [{ key: "salaryAmount", label: "Monthly Salary (₹)", type: "number" }]
            : [
                { key: "baseTripRate", label: "Base Fee Per Trip (₹)", type: "number" },
                { key: "perKmRate", label: "Rate Per KM (₹)", type: "number" }
              ]
          )
        ]}
        values={addForm}
        onChange={(key, value) => setAddForm((prev) => ({ ...prev, [key]: value }))}
        onSubmit={submitAdd}
      />

      <SupplyFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Partner: ${currentRow?.partnerName}`}
        submitLabel="Update Settings"
        fields={[
          { key: "partnerName", label: "Partner Name" },
          { key: "phone", label: "Phone" },
          {
            key: "vehicleType",
            label: "Vehicle Type",
            type: "select",
            options: [
              { value: "bike", label: "Bike" },
              { value: "scooter", label: "Scooter" },
              { value: "van", label: "Van" },
            ],
          },
          {
            key: "paymentType",
            label: "Payment Model",
            type: "select",
            options: [
              { value: "per_trip", label: "Distance/Trip Based" },
              { value: "salary", label: "Fixed Salary" },
            ],
          },
          ...(editForm.paymentType === "salary" 
            ? [{ key: "salaryAmount", label: "Monthly Salary (₹)", type: "number" }]
            : [
                { key: "baseTripRate", label: "Base Fee Per Trip (₹)", type: "number" },
                { key: "perKmRate", label: "Rate Per KM (₹)", type: "number" }
              ]
          )
        ]}
        values={editForm}
        onChange={(key, value) => setEditForm((prev) => ({ ...prev, [key]: value }))}
        onSubmit={submitEdit}
      />

      <SupplyConfirmModal
        isOpen={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Update Partner Status"
        message={
          currentRow
            ? `Change status for ${currentRow.partnerName}?`
            : "Update status?"
        }
        confirmLabel="Confirm"
        onConfirm={confirmStatus}
      />

      <SupplyInfoModal
        isOpen={trackOpen}
        onClose={() => setTrackOpen(false)}
        title="Pickup Tracking"
        message={
          currentRow
            ? `${currentRow.partnerName} has ${currentRow.assignedPickups} assigned pickups and current status is ${currentRow.status}.`
            : "No partner selected."
        }
      />
    </>
  );
};

export default PickupPartnersPage;
