import React, { useEffect, useMemo, useState } from "react";
import { Store, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import SupplyModuleTable from "../components/supply/SupplyModuleTable";
import {
  SupplyFormModal,
  SupplyInfoModal,
} from "../components/supply/SupplyActionModals";
import PurchaseRequestListPanel from "../components/PurchaseRequestListPanel";
import Modal from "@shared/components/ui/Modal";
import { adminApi } from "../services/adminApi";

const emptyVendorForm = {
  name: "",
  shopName: "",
  email: "",
  phone: "",
  password: "",
  lat: "",
  lng: "",
  radius: "5",
  status: "Active",
};

const emptyRequestForm = { productId: "", quantity: "100", notes: "" };

function sellerProductOptionLabel(product) {
  const stock = Number(product?.catalogStock ?? product?.stock ?? 0);
  const supply = Number(product?.purchasePrice ?? product?.price ?? 0);
  const kind = product?.masterProductId ? "Catalog" : "Own";
  return `${product?.name || "Product"} · ${kind} · stock ${stock}${supply > 0 ? ` · ₹${supply}` : ""}`;
}

const VendorManagementPage = () => {
  const [rows, setRows] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [currentVendor, setCurrentVendor] = useState(null);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);
  const [requestForm, setRequestForm] = useState(emptyRequestForm);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [sellerProductsLoading, setSellerProductsLoading] = useState(false);
  const [productPurchaseRequests, setProductPurchaseRequests] = useState([]);
  const [productPrLoading, setProductPrLoading] = useState(false);
  const [prSubmitting, setPrSubmitting] = useState(false);

  useEffect(() => {
    fetchSellers();
  }, []);

  const toLocationText = (seller) => {
    const coords = seller?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return "N/A";
    const lat = Number(coords[1]);
    const lng = Number(coords[0]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "N/A";
    return "Geospatial Verified";
  };

  const normalizeRows = (list) =>
    (Array.isArray(list) ? list : []).map((item) => ({
      id: item._id,
      vendorName: item.shopName || item.name || "N/A",
      name: item.name || "",
      shopName: item.shopName || "",
      email: item.email || "",
      phoneNumber: item.phone || "N/A",
      location: toLocationText(item),
      radius: item.serviceRadius ?? 5,
      status: item.isActive ? "Active" : "Inactive",
      raw: item,
    }));

  const fetchSellers = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getSellers();
      let payload = res?.data?.result || res?.data?.results || [];
      
      // If payload is an object containing 'items', extract it
      if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload.items) {
        payload = payload.items;
      }
      
      setRows(normalizeRows(payload));
    } catch (error) {
      setInfoMessage(error?.response?.data?.message || "Failed to load sellers.");
      setInfoOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchSellerProducts = async (sellerId) => {
    if (!sellerId) {
      setSellerProducts([]);
      return;
    }
    setSellerProductsLoading(true);
    try {
      const res = await adminApi.getProducts({
        page: 1,
        limit: 100,
        ownerType: "seller",
        sellerId,
      });
      const payload = res?.data?.result || {};
      setSellerProducts(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      setSellerProducts([]);
    } finally {
      setSellerProductsLoading(false);
    }
  };

  const toSellerPayload = (form, { requirePassword }) => {
    const name = form.name.trim();
    const shopName = form.shopName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const password = form.password.trim();
    if (!name || !shopName || !email || !phone || (requirePassword && !password)) {
      return null;
    }

    const payload = {
      name,
      shopName,
      email,
      phone,
      radius: Math.max(1, Number(form.radius || 5)),
      isActive: form.status === "Active",
      isVerified: true,
    };

    if (password) payload.password = password;

    const lat = form.lat === "" ? undefined : Number(form.lat);
    const lng = form.lng === "" ? undefined : Number(form.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      payload.lat = lat;
      payload.lng = lng;
    }

    return payload;
  };

  const addVendor = async () => {
    const payload = toSellerPayload(vendorForm, { requirePassword: true });
    if (!payload) return;
    try {
      await adminApi.createSeller(payload);
      setVendorForm(emptyVendorForm);
      setAddOpen(false);
      await fetchSellers();
      setInfoMessage("Seller created with canonical seller schema.");
      setInfoOpen(true);
    } catch (error) {
      setInfoMessage(error?.response?.data?.message || "Failed to create seller.");
      setInfoOpen(true);
    }
  };

  const openEdit = (row) => {
    setCurrentVendor(row);
    setVendorForm({
      name: row.name || "",
      shopName: row.shopName || "",
      email: row.email || "",
      phone: row.phoneNumber === "N/A" ? "" : row.phoneNumber,
      password: "",
      lat:
        row.raw?.location?.coordinates?.[1] !== undefined
          ? String(row.raw.location.coordinates[1])
          : "",
      lng:
        row.raw?.location?.coordinates?.[0] !== undefined
          ? String(row.raw.location.coordinates[0])
          : "",
      radius: String(row.radius ?? 5),
      status: row.status,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!currentVendor) return;
    const payload = toSellerPayload(vendorForm, { requirePassword: false });
    if (!payload) return;

    try {
      await adminApi.updateSeller(currentVendor.id, payload);
      setEditOpen(false);
      await fetchSellers();
      setInfoMessage("Seller updated using shared seller schema.");
      setInfoOpen(true);
    } catch (error) {
      setInfoMessage(error?.response?.data?.message || "Failed to update seller.");
      setInfoOpen(true);
    }
  };

  const fetchProductPurchaseRequests = async (productId) => {
    if (!productId) {
      setProductPurchaseRequests([]);
      return;
    }
    setProductPrLoading(true);
    try {
      const res = await adminApi.getPurchaseRequests({
        productId,
        limit: 50,
        page: 1,
      });
      const payload = res?.data?.result || {};
      setProductPurchaseRequests(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      setProductPurchaseRequests([]);
    } finally {
      setProductPrLoading(false);
    }
  };

  const openRequest = async (row) => {
    setCurrentVendor(row);
    setRequestForm(emptyRequestForm);
    setSellerProducts([]);
    setProductPurchaseRequests([]);
    setRequestOpen(true);
    await fetchSellerProducts(row.id);
  };

  const createPurchaseRequest = async () => {
    if (!currentVendor) return;
    const productId = String(requestForm.productId || "").trim();
    if (!productId) {
      setInfoMessage("Please select a seller product.");
      setInfoOpen(true);
      return;
    }
    if (!sellerProducts.some((p) => String(p._id) === productId)) {
      setInfoMessage("Selected product does not belong to this seller.");
      setInfoOpen(true);
      return;
    }
    const qty = Math.max(1, Number(requestForm.quantity || 1));
    if (!Number.isFinite(qty) || qty <= 0) {
      setInfoMessage("Please enter valid quantity.");
      setInfoOpen(true);
      return;
    }
    setPrSubmitting(true);
    try {
      await adminApi.createManualPurchaseRequest({
        vendorId: currentVendor.id,
        productId,
        quantity: qty,
        notes: requestForm.notes,
      });
      await fetchProductPurchaseRequests(productId);
      setRequestForm((prev) => ({ ...emptyRequestForm, productId }));
      setInfoMessage("Purchase request created and synced to Purchase Requests module.");
      setInfoOpen(true);
    } catch (error) {
      setInfoMessage(error?.response?.data?.message || "Failed to create purchase request.");
      setInfoOpen(true);
    } finally {
      setPrSubmitting(false);
    }
  };

  const toggleVendorStatus = async (row) => {
    try {
      const newStatus = !row.raw.isActive;
      await adminApi.updateSeller(row.id, { isActive: newStatus, isVerified: newStatus });
      await fetchSellers();
      setInfoMessage(`Seller is now ${newStatus ? 'Active' : 'Inactive'}.`);
      setInfoOpen(true);
    } catch (error) {
      setInfoMessage(error?.response?.data?.message || "Failed to update seller status.");
      setInfoOpen(true);
    }
  };

  const stats = useMemo(() => {
    const active = rows.filter((item) => item.status.toLowerCase() === "active").length;
    const withGeo = rows.filter((item) => item.location !== "N/A").length;
    return [
      { label: "Total Sellers", value: String(rows.length) },
      { label: "Active Sellers", value: String(active) },
      { label: "Inactive Sellers", value: String(Math.max(0, rows.length - active)) },
      { label: "Geo Mapped", value: String(withGeo) },
    ];
  }, [rows]);

  return (
    <>
      <SupplyModuleTable
        title="Vendors / Sellers"
        subtitle="Manage suppliers using the same canonical schema used by the Seller app."
        icon={Store}
        topActions={[
          {
            label: "Add Seller",
            onClick: () => {
              setVendorForm(emptyVendorForm);
              setAddOpen(true);
            },
          },
          {
            label: loading ? "Refreshing..." : "Refresh",
            onClick: fetchSellers,
          },
        ]}
        stats={stats}
        columns={[
          { key: "vendorName", label: "Shop Name" },
          { key: "name", label: "Owner Name" },
          { key: "email", label: "Email" },
          { key: "phoneNumber", label: "Phone Number" },
          { key: "location", label: "Location" },
          { key: "radius", label: "Radius (km)" },
          { 
            key: "status", 
            label: "Status",
            render: (row) => (
               <div className="flex items-center gap-2">
                 <button 
                     onClick={() => toggleVendorStatus(row)}
                     className={cn(
                         "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300",
                         row.raw.isActive ? "bg-emerald-500" : "bg-slate-300"
                     )}
                 >
                     <span 
                         className={cn(
                             "inline-flex items-center justify-center h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                             row.raw.isActive ? "translate-x-4" : "translate-x-1"
                         )} 
                     >
                       {row.raw.isActive && <Check className="text-emerald-500 h-2.5 w-2.5" />}
                     </span>
                 </button>
                 <span className={cn(
                     "text-[10px] font-bold tracking-wider uppercase",
                     row.raw.isActive ? "text-emerald-600" : "text-slate-500"
                 )}>
                     {row.raw.isActive ? 'Active' : 'Inactive'}
                 </span>
               </div>
            )
          },
        ]}
        rows={rows}
        statusColumn="status"
        renderActions={(row) => (
          <>
            <button
              type="button"
              onClick={() => openEdit(row)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Edit Seller
            </button>
            <button
              type="button"
              onClick={() => openRequest(row)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
              Send Purchase Request
            </button>
          </>
        )}
      />

      <SupplyFormModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Seller"
        submitLabel="Add"
        fields={[
          { key: "name", label: "Owner Name" },
          { key: "shopName", label: "Shop Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "password", label: "Password (min 6 chars)" },
          { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
        ]}
        values={vendorForm}
        onChange={(key, value) => setVendorForm((prev) => ({ ...prev, [key]: value }))}
        onSubmit={addVendor}
      />

      <SupplyFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Seller${currentVendor ? ` - ${currentVendor.vendorName}` : ""}`}
        submitLabel="Save"
        fields={[
          { key: "name", label: "Owner Name" },
          { key: "shopName", label: "Shop Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "password", label: "New Password (optional)" },
          { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
        ]}
        values={vendorForm}
        onChange={(key, value) => setVendorForm((prev) => ({ ...prev, [key]: value }))}
        onSubmit={saveEdit}
      />

      <Modal
        isOpen={requestOpen}
        onClose={() => {
          setRequestOpen(false);
          setSellerProducts([]);
          setProductPurchaseRequests([]);
        }}
        title={`Purchase Request${currentVendor ? ` — ${currentVendor.vendorName}` : ""}`}
        size="xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setRequestOpen(false);
                setSellerProducts([]);
                setProductPurchaseRequests([]);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-400 uppercase"
            >
              Close
            </button>
            <button
              type="button"
              onClick={createPurchaseRequest}
              disabled={sellerProductsLoading || prSubmitting || !requestForm.productId}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {prSubmitting ? "Sending…" : "Send new request"}
            </button>
          </>
        }
      >
        <div className="space-y-6 py-1">
          {requestForm.productId ? (
            <PurchaseRequestListPanel
              requests={productPurchaseRequests}
              loading={productPrLoading}
              showProductColumn={false}
              emptyMessage="No purchase requests for this product yet."
            />
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-500 text-center">
              Select a seller product below to view its existing purchase requests.
            </div>
          )}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
              New purchase request
            </p>
            <label className="block">
              <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">
                Seller product ({sellerProducts.length} listed)
              </span>
              <select
                value={requestForm.productId}
                onChange={(e) => {
                  const pid = e.target.value;
                  setRequestForm((prev) => ({ ...prev, productId: pid }));
                  fetchProductPurchaseRequests(pid);
                }}
                disabled={sellerProductsLoading}
                className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none"
              >
                <option value="">Select a product from this seller</option>
                {sellerProducts.map((p) => (
                  <option key={p._id} value={p._id}>
                    {sellerProductOptionLabel(p)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">Quantity</span>
                <input
                  type="number"
                  min="1"
                  value={requestForm.quantity}
                  onChange={(e) =>
                    setRequestForm((prev) => ({ ...prev, quantity: e.target.value }))
                  }
                  className="mt-1 w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-black outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">Notes</span>
                <input
                  type="text"
                  value={requestForm.notes}
                  onChange={(e) =>
                    setRequestForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="mt-1 w-full px-4 py-3 bg-slate-100 rounded-xl text-sm outline-none"
                />
              </label>
            </div>
          </div>
        </div>
      </Modal>

      <SupplyInfoModal
        isOpen={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Purchase Request"
        message={infoMessage}
      />
    </>
  );
};

export default VendorManagementPage;
