import React, { useEffect, useMemo, useState } from "react";
import { Bike } from "lucide-react";
import SupplyModuleTable from "../components/supply/SupplyModuleTable";
import {
  SupplyConfirmModal,
  SupplyFormModal,
  SupplyInfoModal,
} from "../components/supply/SupplyActionModals";
import { supplyChainStorage } from "../services/supplyChainStorage";

const DeliveryPartnersPage = () => {
  const [rows, setRows] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);
  const [addForm, setAddForm] = useState({ deliveryPartnerName: "", phone: "" });

  useEffect(() => {
    setRows(supplyChainStorage.getDeliveryPartners());
  }, []);

  const persist = (nextRows) => {
    setRows(nextRows);
    supplyChainStorage.saveDeliveryPartners(nextRows);
  };

  const submitAdd = () => {
    const deliveryPartnerName = addForm.deliveryPartnerName.trim();
    if (!deliveryPartnerName) return;

    persist([
      {
        id: supplyChainStorage.createId("DP"),
        deliveryPartnerName,
        phone: addForm.phone.trim() || "N/A",
        activeDeliveries: 0,
        status: "Available",
      },
      ...rows,
    ]);

    setAddForm({ deliveryPartnerName: "", phone: "" });
    setAddOpen(false);
  };

  const openAssign = (row) => {
    setCurrentRow(row);
    setAssignOpen(true);
  };

  const confirmAssign = () => {
    if (!currentRow) return;
    persist(
      rows.map((item) =>
        item.id === currentRow.id
          ? {
              ...item,
              activeDeliveries: Number(item.activeDeliveries || 0) + 1,
              status: "Active",
            }
          : item,
      ),
    );
    setAssignOpen(false);
  };

  const openTrack = (row) => {
    setCurrentRow(row);
    setTrackOpen(true);
  };

  const stats = useMemo(() => {
    const totalActiveDeliveries = rows.reduce(
      (sum, item) => sum + Number(item.activeDeliveries || 0),
      0,
    );
    const available = rows.filter((item) => item.status === "Available").length;

    return [
      { label: "Total Partners", value: String(rows.length) },
      { label: "Active Deliveries", value: String(totalActiveDeliveries) },
      { label: "Idle Partners", value: String(available) },
      {
        label: "Avg Delivery Load",
        value: rows.length ? (totalActiveDeliveries / rows.length).toFixed(1) : "0.0",
      },
    ];
  }, [rows]);

  return (
    <>
      <SupplyModuleTable
        title="Delivery Partners"
        subtitle="Operate last-mile partner pool with assignment control and active-delivery visibility."
        icon={Bike}
        topActions={[
          {
            label: "Add Delivery Partner",
            onClick: () => {
              setAddForm({ deliveryPartnerName: "", phone: "" });
              setAddOpen(true);
            },
          },
        ]}
        stats={stats}
        columns={[
          { key: "deliveryPartnerName", label: "Delivery Partner Name" },
          { key: "phone", label: "Phone" },
          { key: "activeDeliveries", label: "Active Deliveries" },
          { key: "status", label: "Status" },
        ]}
        rows={rows}
        statusColumn="status"
        renderActions={(row) => (
          <>
            <button
              type="button"
              onClick={() => openAssign(row)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Assign Delivery
            </button>
            <button
              type="button"
              onClick={() => openTrack(row)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
              Track Delivery
            </button>
          </>
        )}
      />

      <SupplyFormModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Delivery Partner"
        submitLabel="Add"
        fields={[
          { key: "deliveryPartnerName", label: "Delivery Partner Name" },
          { key: "phone", label: "Phone" },
        ]}
        values={addForm}
        onChange={(key, value) =>
          setAddForm((prev) => ({ ...prev, [key]: value }))
        }
        onSubmit={submitAdd}
      />

      <SupplyConfirmModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign Delivery"
        message={
          currentRow
            ? `Assign one more delivery to ${currentRow.deliveryPartnerName}?`
            : "Assign this delivery?"
        }
        confirmLabel="Assign"
        onConfirm={confirmAssign}
      />

      <SupplyInfoModal
        isOpen={trackOpen}
        onClose={() => setTrackOpen(false)}
        title="Delivery Tracking"
        message={
          currentRow
            ? `${currentRow.deliveryPartnerName} is handling ${currentRow.activeDeliveries} active deliveries.`
            : "No partner selected."
        }
      />
    </>
  );
};

export default DeliveryPartnersPage;
