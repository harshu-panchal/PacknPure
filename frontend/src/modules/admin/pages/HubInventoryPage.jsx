import React, { useEffect, useMemo, useState } from "react";
import { Boxes, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import Modal from "@shared/components/ui/Modal";
import SupplyModuleTable from "../components/supply/SupplyModuleTable";
import { SupplyFormModal } from "../components/supply/SupplyActionModals";
import { adminApi } from "../services/adminApi";

const statusText = (value) => {
  const v = String(value || "").toLowerCase();
  if (v === "low_stock") return "Low Stock";
  if (v === "out_of_stock") return "Out of Stock";
  return "Healthy";
};

function variantOptionsFromProduct(product) {
  const rows = product?.variants;
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.map((v, index) => ({
    variantId: v._id ? String(v._id) : String(index),
    index,
    name: v.name || `Variant ${index + 1}`,
    stock: Number(v.stock) || 0,
    unit: v.unit || product?.unit || "—",
  }));
}

function variantOptionsFromRow(row) {
  if (Array.isArray(row?.variants) && row.variants.length > 0) {
    return row.variants.map((v, index) => ({
      variantId: v.variantId || String(index),
      index: v.index ?? index,
      name: v.name || `Variant ${index + 1}`,
      stock: Number(v.stock) || 0,
      unit: v.unit || "—",
    }));
  }
  return [];
}

const HubInventoryPage = () => {
  const [rows, setRows] = useState([]);
  const [inventoryTotals, setInventoryTotals] = useState({
    totalHubAvailable: 0,
    totalHubReserved: 0,
    totalSellerAvailable: 0,
    totalSellerCommitted: 0,
  });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    productId: "",
    hubStockQuantity: "0",
    minimumStockAlert: "10",
    variantId: "",
  });

  const [stockOpen, setStockOpen] = useState(false);
  const [stockRow, setStockRow] = useState(null);
  const [stockDelta, setStockDelta] = useState("10");
  const [stockVariantId, setStockVariantId] = useState("");
  const [stockPricing, setStockPricing] = useState({
    price: "",
    salePrice: "",
    purchasePrice: "",
  });

  const [minOpen, setMinOpen] = useState(false);
  const [minRow, setMinRow] = useState(null);
  const [minValue, setMinValue] = useState("0");

  const [priceOpen, setPriceOpen] = useState(false);
  const [priceRow, setPriceRow] = useState(null);
  const [priceForm, setPriceForm] = useState({
    marginType: "percent",
    marginValue: "15",
    sellPrice: "0",
  });

  const fetchInventory = async (params = {}) => {
    try {
      setLoading(true);
      const res = await adminApi.getHubInventory(params);
      let payload = res.data?.result || res.data?.results || {};

      let items = [];
      let totals = {
        totalHubAvailable: 0,
        totalHubReserved: 0,
        totalSellerAvailable: 0,
        totalSellerCommitted: 0,
      };
      if (Array.isArray(payload)) {
        items = payload;
      } else if (payload && Array.isArray(payload.items)) {
        items = payload.items;
        totals = payload.totals || totals;
      }

      setRows(items);
      setInventoryTotals({
        totalHubAvailable: Number(totals.totalHubAvailable || 0),
        totalHubReserved: Number(totals.totalHubReserved || 0),
        totalSellerAvailable: Number(totals.totalSellerAvailable || 0),
        totalSellerCommitted: Number(totals.totalSellerCommitted || 0),
      });
    } catch {
      setRows([]);
      setInventoryTotals({
        totalHubAvailable: 0,
        totalHubReserved: 0,
        totalSellerAvailable: 0,
        totalSellerCommitted: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await adminApi.getProducts({
        page: 1,
        limit: 300,
        status: "active",
        ownerType: "admin",
      });
      const payload = res.data?.result || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      setProducts(items);
      const first = items[0];
      const firstVariants = variantOptionsFromProduct(first);
      setAddForm((prev) => ({
        ...prev,
        productId: prev.productId || first?._id || "",
        variantId: firstVariants[0]?.variantId || "",
      }));
    } catch {
      setProducts([]);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchProducts();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchInventory({
        ...(searchText ? { search: searchText } : {}),
        ...(inventoryFilter !== "all" ? { filter: inventoryFilter } : {}),
      });
    }, 250);
    return () => clearTimeout(t);
  }, [searchText, inventoryFilter]);

  const selectedProduct = useMemo(
    () => products.find((p) => p._id === addForm.productId) || null,
    [products, addForm.productId],
  );

  const addProductVariants = useMemo(
    () => variantOptionsFromProduct(selectedProduct),
    [selectedProduct],
  );

  const addHasVariants = addProductVariants.length > 0;

  const stockVariants = useMemo(
    () => variantOptionsFromRow(stockRow),
    [stockRow],
  );

  const stockHasVariants = stockVariants.length > 0;

  const selectedStockVariant = useMemo(() => {
    if (!stockHasVariants) return null;
    return (
      stockVariants.find((v) => v.variantId === stockVariantId) || stockVariants[0]
    );
  }, [stockHasVariants, stockVariants, stockVariantId]);

  const openAddModal = () => {
    const first = products[0];
    const variants = variantOptionsFromProduct(first);
    setAddForm((prev) => ({
      productId: prev.productId || first?._id || "",
      hubStockQuantity: "0",
      minimumStockAlert: "10",
      variantId: variants[0]?.variantId || "",
    }));
    setAddOpen(true);
  };

  const submitAdd = async () => {
    if (!addForm.productId) return;
    const qty = Math.max(0, Number(addForm.hubStockQuantity || 0));
    const minAlert = Math.max(0, Number(addForm.minimumStockAlert || 0));

    if (qty <= 0) {
      toast.error("Enter a quantity greater than zero");
      return;
    }

    if (addHasVariants && !addForm.variantId) {
      toast.error("Select which variant to add stock to");
      return;
    }

    try {
      const payload = {
        productId: addForm.productId,
        quantity: qty,
        minimumStockAlert: minAlert,
      };
      if (addHasVariants) {
        const v = addProductVariants.find((row) => row.variantId === addForm.variantId);
        if (v?.variantId && String(v.variantId).length === 24) {
          payload.variantId = v.variantId;
        } else {
          payload.variantIndex = v?.index ?? 0;
        }
      }

      await adminApi.upsertHubInventory(payload);
      toast.success("Hub stock added");
      setAddOpen(false);
      await fetchInventory();
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to add hub stock";
      toast.error(msg);
    }
  };

  const openStockModal = (row) => {
    const variants = variantOptionsFromRow(row);
    setStockRow(row);
    setStockDelta("10");
    setStockVariantId(variants[0]?.variantId || "");
    setStockPricing({
      price: String(row.catalogMrp || row.mrp || row.price || row.sellPrice || ""),
      salePrice: String(row.sellPrice || ""),
      purchasePrice: String(row.purchaseCost || row.purchasePrice || ""),
    });
    setStockOpen(true);
  };

  const submitStock = async () => {
    if (!stockRow?._id) return;
    const delta = Number(stockDelta || 0);
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error("Enter a non-zero quantity");
      return;
    }

    if (stockHasVariants && !stockVariantId) {
      toast.error("Select which variant to update");
      return;
    }

    try {
      const payload = { delta };
      if (stockHasVariants) {
        const v = selectedStockVariant;
        if (v?.variantId && String(v.variantId).length === 24) {
          payload.variantId = v.variantId;
        } else {
          payload.variantIndex = v?.index ?? 0;
        }
      }
      if (stockPricing.price !== "") payload.price = Number(stockPricing.price);
      if (stockPricing.salePrice !== "") payload.salePrice = Number(stockPricing.salePrice);
      if (stockPricing.purchasePrice !== "") {
        payload.purchasePrice = Number(stockPricing.purchasePrice);
      }

      const res = await adminApi.adjustHubInventoryStock(stockRow._id, payload);
      const result = res.data?.result || {};
      const total = result.catalogStock ?? result.availableQty;
      toast.success(
        stockHasVariants
          ? `Variant updated (hub total: ${total ?? "—"} units)`
          : "Hub stock updated",
      );
      setStockOpen(false);
      await fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update stock");
    }
  };

  const openPriceModal = (row) => {
    setPriceRow(row);
    setPriceForm({
      marginType: row.marginType || "percent",
      marginValue: String(row.marginValue || 15),
      sellPrice: String(row.sellPrice || 0),
    });
    setPriceOpen(true);
  };

  const submitPrice = async () => {
    if (!priceRow?._id) return;
    try {
      await adminApi.upsertHubInventory({
        productId: priceRow.productId,
        quantity: 0,
        marginType: priceForm.marginType,
        marginValue: Number(priceForm.marginValue),
        sellPrice: Number(priceForm.sellPrice),
      });
      toast.success("Pricing updated");
      setPriceOpen(false);
      await fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update pricing");
    }
  };

  const openMinModal = (row) => {
    setMinRow(row);
    setMinValue(String(row.minimumStockAlert || 0));
    setMinOpen(true);
  };

  const submitMin = async () => {
    if (!minRow?._id) return;
    const nextMin = Math.max(0, Number(minValue || 0));
    try {
      await adminApi.updateHubInventoryReorderLevel(minRow._id, nextMin);
      toast.success("Minimum alert updated");
      setMinOpen(false);
      await fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update minimum alert");
    }
  };

  const handleRemoveHubInventory = async (row) => {
    if (!window.confirm(`Are you sure you want to remove ${row.productNameText || 'this product'} from Hub Inventory?`)) return;
    try {
      await adminApi.deleteHubInventory(row._id);
      toast.success("Item removed from Hub Inventory");
      await fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove item");
    }
  };

  const tableRows = useMemo(
    () =>
      rows.map((item) => ({
        ...item,
        productNameText: item.productName,
        status: item.statusLabel || statusText(item.status),
        reservedQty: Number(item.variantTotals?.hr ?? item.reservedQty ?? 0),
        hubStockQuantity:
          item.hasVariants && item.variantCount > 0
            ? `${Number(item.variantTotals?.ha ?? item.hubStockQuantity ?? 0)} (${item.variantCount} variants)`
            : Number(item.variantTotals?.ha ?? item.hubStockQuantity ?? 0),
        productName: (
          <div className="flex items-center gap-3">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.productName}
                className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                <ImagePlus className="h-4 w-4" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-slate-800">{item.productName}</span>
              {item.hasVariants ? (
                <span className="text-[10px] font-bold uppercase tracking-wide text-purple-600">
                  {item.variantCount} variant{item.variantCount > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
          </div>
        ),
      })),
    [rows],
  );

  const stats = useMemo(() => {
    const lowStock = rows.filter((item) => statusText(item.status) === "Low Stock").length;
    return [
      { label: "Total SKUs", value: String(rows.length) },
      { label: "Low Stock Alerts", value: String(lowStock) },
      { label: "Total Hub Available", value: String(inventoryTotals.totalHubAvailable || 0) },
      { label: "Total Hub Reserved", value: String(inventoryTotals.totalHubReserved || 0) },
      { label: "Total Seller Available", value: String(inventoryTotals.totalSellerAvailable || 0) },
      { label: "Total Seller Committed", value: String(inventoryTotals.totalSellerCommitted || 0) },
      {
        label: "Health Score",
        value: rows.length ? `${Math.round(((rows.length - lowStock) / rows.length) * 100)}%` : "0%",
      },
    ];
  }, [rows, inventoryTotals]);

  return (
    <>
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search product / variant / seller..."
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
        />
        <select
          value={inventoryFilter}
          onChange={(e) => setInventoryFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
        >
          <option value="all">All</option>
          <option value="low_stock">Low Stock</option>
          <option value="reserved">Reserved</option>
          <option value="committed">Committed</option>
          <option value="transit">Transit</option>
          <option value="qa_pending">QA Pending</option>
        </select>
        <div className="flex items-center text-xs text-slate-500">
          Variant inventory values are backend-computed.
        </div>
      </div>

      <SupplyModuleTable
        title="Hub Inventory"
        subtitle="SOP mode: link hub stock to catalog products. Multi-variant products: pick a variant when adding stock."
        icon={Boxes}
        topActions={[
          { label: "Add Stock", onClick: openAddModal },
          {
            label: loading ? "Refreshing..." : "Refresh",
            onClick: () =>
              fetchInventory({
                ...(searchText ? { search: searchText } : {}),
                ...(inventoryFilter !== "all" ? { filter: inventoryFilter } : {}),
              }),
          },
        ]}
        stats={stats}
        columns={[
          { key: "productName", label: "Product Name" },
          { key: "category", label: "Category" },
          { key: "sellerName", label: "Supplier" },
          { key: "hubStockQuantity", label: "Hub Stock Quantity" },
          { key: "reservedQty", label: "Reserved Qty" },
          { key: "sellPrice", label: "Selling Price (₹)" },
          { key: "minimumStockAlert", label: "Minimum Stock Alert" },
          { key: "status", label: "Status" },
        ]}
        rows={tableRows}
        statusColumn="status"
        renderActions={(row) => (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openStockModal(row)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Stock
            </button>
            <button
              type="button"
              onClick={() => openPriceModal(row)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
              Edit Price
            </button>
            <button
              type="button"
              onClick={() => openMinModal(row)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
              Update Min
            </button>
            <button
              type="button"
              onClick={() => handleRemoveHubInventory(row)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
              Remove
            </button>
          </div>
        )}
      />

      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Inventory Item (Catalog Linked)"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitAdd}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-800">
              Add
            </button>
          </>
        }>
        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">
              Select Product
            </span>
            <select
              value={addForm.productId}
              onChange={(e) => {
                const product = products.find((p) => p._id === e.target.value);
                const variants = variantOptionsFromProduct(product);
                setAddForm((prev) => ({
                  ...prev,
                  productId: e.target.value,
                  variantId: variants[0]?.variantId || "",
                }));
              }}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400">
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                  {p.variants?.length > 0 ? ` (${p.variants.length} variants)` : ""}
                </option>
              ))}
            </select>
          </label>

          {selectedProduct ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-700">Selected: {selectedProduct.name}</p>
              <p className="text-[11px] text-slate-500">
                Category: {selectedProduct.categoryId?.name || "N/A"}
                {addHasVariants
                  ? ` · ${addProductVariants.length} variants (stock is per variant)`
                  : ""}
              </p>
            </div>
          ) : null}

          {addHasVariants ? (
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">
                Which variant?
              </span>
              <select
                value={addForm.variantId}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, variantId: e.target.value }))
                }
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400">
                {addProductVariants.map((v) => (
                  <option key={v.variantId} value={v.variantId}>
                    {v.name} — {v.stock} {v.unit} in hub
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">
                {addHasVariants ? "Add Quantity (this variant)" : "Add Quantity"}
              </span>
              <input
                type="number"
                min="0"
                value={addForm.hubStockQuantity}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, hubStockQuantity: e.target.value }))
                }
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">
                Minimum Stock Alert
              </span>
              <input
                type="number"
                min="0"
                value={addForm.minimumStockAlert}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, minimumStockAlert: e.target.value }))
                }
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            </label>
          </div>

          {addHasVariants ? (
            <p className="text-[11px] font-medium text-slate-500">
              Hub total stock is the sum of all variant quantities after this update.
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={stockOpen}
        onClose={() => setStockOpen(false)}
        title={`Stock${stockRow ? ` - ${stockRow.productNameText || ""}` : ""}`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setStockOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={submitStock}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-800"
            >
              Update Stock
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-2"><span className="font-semibold">Hub Available:</span> {stockRow?.variantTotals?.ha ?? 0}</div>
            <div className="rounded-lg bg-slate-50 p-2"><span className="font-semibold">Hub Reserved:</span> {stockRow?.variantTotals?.hr ?? 0}</div>
            <div className="rounded-lg bg-slate-50 p-2"><span className="font-semibold">Seller Available:</span> {stockRow?.variantTotals?.sa ?? 0}</div>
            <div className="rounded-lg bg-slate-50 p-2"><span className="font-semibold">Seller Committed:</span> {stockRow?.variantTotals?.sc ?? 0}</div>
          </div>

          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-2 text-left">Variant</th>
                  <th className="px-2 py-2 text-left">HA</th>
                  <th className="px-2 py-2 text-left">HR</th>
                  <th className="px-2 py-2 text-left">SA</th>
                  <th className="px-2 py-2 text-left">SC</th>
                  <th className="px-2 py-2 text-left">Transit</th>
                  <th className="px-2 py-2 text-left">QA</th>
                </tr>
              </thead>
              <tbody>
                {(stockRow?.variantInventory || []).map((v) => (
                  <tr key={v.variantId || v.index} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-medium">{v.name}</td>
                    <td className="px-2 py-2">{v.ha}</td>
                    <td className="px-2 py-2">{v.hr}</td>
                    <td className="px-2 py-2">{v.sa}</td>
                    <td className="px-2 py-2">{v.sc}</td>
                    <td className="px-2 py-2">{v.transit}</td>
                    <td className="px-2 py-2">{v.qaPending}/{v.qaAccepted}/{v.qaRejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {stockHasVariants ? (
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">
                Variant
              </span>
              <select
                value={stockVariantId}
                onChange={(e) => setStockVariantId(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              >
                {stockVariants.map((v) => (
                  <option key={v.variantId} value={v.variantId}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">Stock Delta (+/-)</span>
              <input
                type="number"
                value={stockDelta}
                onChange={(e) => setStockDelta(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">MRP (optional)</span>
              <input
                type="number"
                value={stockPricing.price}
                onChange={(e) => setStockPricing((prev) => ({ ...prev, price: e.target.value }))}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">Sale Price (optional)</span>
              <input
                type="number"
                value={stockPricing.salePrice}
                onChange={(e) => setStockPricing((prev) => ({ ...prev, salePrice: e.target.value }))}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">Purchase Price (optional)</span>
              <input
                type="number"
                value={stockPricing.purchasePrice}
                onChange={(e) => setStockPricing((prev) => ({ ...prev, purchasePrice: e.target.value }))}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            </label>
          </div>
        </div>
      </Modal>

      <SupplyFormModal
        isOpen={minOpen}
        onClose={() => setMinOpen(false)}
        title={`Update Min Alert${minRow ? ` - ${minRow.productNameText || ""}` : ""}`}
        submitLabel="Save"
        fields={[{ key: "minValue", label: "Minimum Stock Alert", type: "number" }]}
        values={{ minValue }}
        onChange={(_, value) => setMinValue(value)}
        onSubmit={submitMin}
      />

      <SupplyFormModal
        isOpen={priceOpen}
        onClose={() => setPriceOpen(false)}
        title={`Edit Pricing - ${priceRow?.productNameText || ""}`}
        submitLabel="Save Changes"
        fields={[
          {
            key: "marginType",
            label: "Margin Strategy",
            type: "select",
            options: [
              { value: "percent", label: "Percentage (%)" },
              { value: "flat", label: "Flat Profit (₹)" },
            ],
          },
          { key: "marginValue", label: "Margin Value", type: "number" },
          { key: "sellPrice", label: "Direct Selling Price (Overrides Margin)", type: "number" },
        ]}
        values={priceForm}
        onChange={(k, v) => setPriceForm((p) => ({ ...p, [k]: v }))}
        onSubmit={submitPrice}
      />
    </>
  );
};

export default HubInventoryPage;
