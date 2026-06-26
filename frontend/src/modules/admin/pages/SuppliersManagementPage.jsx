import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Store, Plus, RefreshCw } from "lucide-react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineBuildingOffice2,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineEye,
  HiOutlineStar,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineMapPin,
  HiOutlineCheckCircle,
  HiOutlineXMark,
  HiOutlineClock,
  HiOutlineCheck,
  HiOutlineXCircle,
  HiOutlineArrowTrendingUp,
  HiOutlineChevronDown,
} from "react-icons/hi2";
import SellerProductsExpandPanel from "../components/SellerProductsExpandPanel";
import PurchaseRequestListPanel from "../components/PurchaseRequestListPanel";
import Modal from "@shared/components/ui/Modal";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { adminApi } from "../services/adminApi";
import SellerTabs from "../components/SellerTabs";
import {
  SupplyFormModal,
  SupplyInfoModal,
} from "../components/supply/SupplyActionModals";

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
  category: "Grocery",
};

const emptyRequestForm = { productId: "", quantity: "100", notes: "" };

function sellerProductOptionLabel(product) {
  const stock = Number(product?.catalogStock ?? product?.stock ?? 0);
  const supply = Number(product?.purchasePrice ?? product?.price ?? 0);
  const kind = product?.masterProductId ? "Catalog" : "Own";
  return `${product?.name || "Product"} · ${kind} · stock ${stock}${supply > 0 ? ` · ₹${supply}` : ""}`;
}

function extractSellerItems(res) {
  const raw = res?.data;
  if (raw?.result?.items && Array.isArray(raw.result.items)) return raw.result.items;
  if (raw?.result && Array.isArray(raw.result)) return raw.result;
  if (raw?.results && Array.isArray(raw.results)) return raw.results;
  if (raw?.data?.items && Array.isArray(raw.data.items)) return raw.data.items;
  if (raw?.data && Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw)) return raw;
  if (raw?.result?.items) return raw.result.items;
  return [];
}

function normalizeSupplier(item) {
  const coords = item?.location?.coordinates;
  const hasGeo = Array.isArray(coords) && coords.length >= 2;
  const lat = hasGeo ? Number(coords[1]) : null;
  const lng = hasGeo ? Number(coords[0]) : null;

  return {
    _id: item._id,
    shopName: item.shopName || item.name || "N/A",
    name: item.name || "",
    email: item.email || "",
    phone: item.phone || "",
    category: item.category || "General",
    isActive: !!item.isActive,
    isVerified: !!item.isVerified,
    serviceRadius: item.serviceRadius ?? 5,
    hasGeo,
    lat,
    lng,
    locationText:
      hasGeo && Number.isFinite(lat) && Number.isFinite(lng)
        ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        : "Not mapped",
    rating: Number(item.rating) || 0,
    totalOrders: Number(item.totalOrders) || Number(item.stats?.totalOrders) || 0,
    revenue:
      Number(item.totalRevenue) ||
      Number(item.revenue) ||
      Number(item.stats?.totalRevenue) ||
      0,
    productStats: item.productStats || {
      totalProducts: Number(item.productCount) || 0,
      activeProducts: 0,
      pendingProducts: 0,
      inStockProducts: 0,
      totalStock: 0,
    },
    productCount: Number(item.productCount) || Number(item.productStats?.totalProducts) || 0,
    createdAt: item.createdAt,
    raw: item,
  };
}

const SuppliersManagementPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "all";

  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({ minRevenue: 0, minRating: 0 });

  const [viewingSupplier, setViewingSupplier] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState(null);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);
  const [requestForm, setRequestForm] = useState(emptyRequestForm);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [sellerProducts, setSellerProducts] = useState([]);
  const [sellerProductsLoading, setSellerProductsLoading] = useState(false);
  const [productPurchaseRequests, setProductPurchaseRequests] = useState([]);
  const [productPrLoading, setProductPrLoading] = useState(false);
  const [prSubmitting, setPrSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [expandedSellerId, setExpandedSellerId] = useState(null);

  const toggleSellerProducts = (sellerId) => {
    setExpandedSellerId((prev) => (prev === sellerId ? null : sellerId));
  };

  const fetchSuppliers = async () => {
    try {
      setIsLoading(true);
      const res = await adminApi.getSellers({ page: 1, limit: 500 });
      setSuppliers(extractSellerItems(res).map(normalizeSupplier));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load suppliers");
      setSuppliers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

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
      toast.error("Failed to load this seller's products");
    } finally {
      setSellerProductsLoading(false);
    }
  };

  const tabFiltered = useMemo(() => {
    if (activeTab === "verified") {
      return suppliers.filter((s) => s.isVerified);
    }
    if (activeTab === "pending") {
      return suppliers.filter((s) => !s.isVerified);
    }
    return suppliers;
  }, [suppliers, activeTab]);

  const categories = useMemo(() => {
    const set = new Set(suppliers.map((s) => s.category).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return tabFiltered.filter((s) => {
      const matchesSearch =
        !term ||
        s.shopName.toLowerCase().includes(term) ||
        s.name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.phone.includes(term);

      const matchesCategory = filterCategory === "all" || s.category === filterCategory;

      let matchesStatus = true;
      if (filterStatus === "active") matchesStatus = s.isActive;
      if (filterStatus === "inactive") matchesStatus = !s.isActive;
      if (filterStatus === "verified") matchesStatus = s.isVerified;
      if (filterStatus === "pending") matchesStatus = !s.isVerified;

      const matchesRevenue = s.revenue >= (Number(advancedFilters.minRevenue) || 0);
      const matchesRating = s.rating >= (Number(advancedFilters.minRating) || 0);

      return matchesSearch && matchesCategory && matchesStatus && matchesRevenue && matchesRating;
    });
  }, [tabFiltered, searchTerm, filterCategory, filterStatus, advancedFilters]);

  const stats = useMemo(() => {
    const active = suppliers.filter((s) => s.isActive).length;
    const verified = suppliers.filter((s) => s.isVerified).length;
    const pending = suppliers.filter((s) => !s.isVerified).length;
    const geoMapped = suppliers.filter((s) => s.hasGeo).length;
    const elite = suppliers.filter((s) => s.rating >= 4.5).length;
    const totalRevenue = suppliers.reduce((acc, s) => acc + s.revenue, 0);
    const totalOrders = suppliers.reduce((acc, s) => acc + s.totalOrders, 0);

    return {
      total: suppliers.length,
      active,
      verified,
      pending,
      geoMapped,
      elite,
      totalRevenue,
      totalOrders,
    };
  }, [suppliers]);

  const toSellerPayload = (form, { requirePassword }) => {
    const name = form.name.trim();
    const shopName = form.shopName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const password = form.password.trim();
    if (!name || !shopName || !email || !phone || (requirePassword && !password)) return null;

    const payload = {
      name,
      shopName,
      email,
      phone,
      category: form.category || "Grocery",
      radius: Math.max(1, Number(form.radius || 5)),
      isActive: form.status === "Active",
      isVerified: form.status === "Active",
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

  const addSupplier = async () => {
    const payload = toSellerPayload(vendorForm, { requirePassword: true });
    if (!payload) {
      toast.error("Fill all required fields including password");
      return;
    }
    try {
      await adminApi.createSeller(payload);
      setAddOpen(false);
      setVendorForm(emptyVendorForm);
      await fetchSuppliers();
      toast.success("Supplier account created");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to create supplier");
    }
  };

  const openEdit = (row) => {
    setCurrentSupplier(row);
    setVendorForm({
      name: row.name || "",
      shopName: row.shopName || "",
      email: row.email || "",
      phone: row.phone || "",
      password: "",
      lat: row.lat != null ? String(row.lat) : "",
      lng: row.lng != null ? String(row.lng) : "",
      radius: String(row.serviceRadius ?? 5),
      status: row.isActive ? "Active" : "Inactive",
      category: row.category || "Grocery",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!currentSupplier) return;
    const payload = toSellerPayload(vendorForm, { requirePassword: false });
    if (!payload) {
      toast.error("Fill required fields");
      return;
    }
    try {
      await adminApi.updateSeller(currentSupplier._id, payload);
      setEditOpen(false);
      await fetchSuppliers();
      toast.success("Supplier updated");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Update failed");
    }
  };

  const toggleStatus = async (row) => {
    try {
      const newStatus = !row.isActive;
      await adminApi.updateSeller(row._id, {
        isActive: newStatus,
        isVerified: row.isVerified ? newStatus : row.isVerified,
      });
      await fetchSuppliers();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleApprove = async (id) => {
    setProcessingId(id);
    try {
      await adminApi.approveSeller(id);
      toast.success("Supplier approved");
      await fetchSuppliers();
      setIsDetailOpen(false);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Approval failed");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Reject this supplier application?")) return;
    setProcessingId(id);
    try {
      await adminApi.rejectSeller(id);
      toast.success("Application rejected");
      await fetchSuppliers();
      setIsDetailOpen(false);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Rejection failed");
    } finally {
      setProcessingId(null);
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
    setCurrentSupplier(row);
    setRequestForm(emptyRequestForm);
    setSellerProducts([]);
    setProductPurchaseRequests([]);
    setRequestOpen(true);
    await fetchSellerProducts(row._id);
  };

  const createPurchaseRequest = async () => {
    if (!currentSupplier) return;
    const productId = String(requestForm.productId || "").trim();
    const qty = Math.max(1, Number(requestForm.quantity || 1));
    if (!productId) {
      toast.error("Select a seller product");
      return;
    }
    if (!sellerProducts.some((p) => String(p._id) === productId)) {
      toast.error("Selected product does not belong to this seller");
      return;
    }
    const selected = sellerProducts.find((p) => String(p._id) === productId);
    const maxStock = Number(selected?.catalogStock ?? selected?.stock ?? 0);
    if (maxStock > 0 && qty > maxStock) {
      toast.error(`Vendor only has ${maxStock} units available`);
      return;
    }
    setPrSubmitting(true);
    try {
      await adminApi.createManualPurchaseRequest({
        vendorId: currentSupplier._id,
        productId,
        quantity: qty,
        notes: requestForm.notes,
      });
      toast.success("Purchase request created");
      await fetchProductPurchaseRequests(productId);
      setRequestForm((prev) => ({ ...emptyRequestForm, productId }));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to create purchase request");
    } finally {
      setPrSubmitting(false);
    }
  };

  const openDetail = (row) => {
    setViewingSupplier(row);
    setIsDetailOpen(true);
  };

  const statusBadge = (row) => {
    if (!row.isVerified) return <Badge variant="warning">Pending Review</Badge>;
    if (!row.isActive) return <Badge variant="secondary">Inactive</Badge>;
    return <Badge variant="success">Verified</Badge>;
  };

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="ds-h1 flex items-center gap-2">
            <Store className="h-7 w-7 text-primary" />
            Suppliers
            <Badge variant="primary" className="text-[9px] px-1.5 py-0 font-bold uppercase">
              Hub Partners
            </Badge>
          </h1>
          <p className="ds-description mt-0.5">
            One place to onboard suppliers, verify accounts, manage coverage, and send procurement requests.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchSuppliers}
            className="flex items-center gap-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setVendorForm(emptyVendorForm);
              setAddOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </button>
        </div>
      </div>

      <div className="mb-6 border-b border-slate-100 pb-4">
        <SellerTabs
          counts={{
            all: stats.total,
            verified: stats.verified,
            pending: stats.pending,
          }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Suppliers", val: stats.total, icon: HiOutlineBuildingOffice2, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Active Accounts", val: stats.active, icon: HiOutlineCheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Pending Approval", val: stats.pending, icon: HiOutlineClock, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Geo Mapped", val: stats.geoMapped, icon: HiOutlineMapPin, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Elite Rated (4.5+)", val: stats.elite, icon: HiOutlineStar, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Procurement Orders", val: stats.totalOrders.toLocaleString(), icon: HiOutlineArrowTrendingUp, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Supply Revenue", val: `₹${(stats.totalRevenue / 100000).toFixed(1)}L`, icon: HiOutlineCheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Verified Partners", val: stats.verified, icon: HiOutlineCheck, color: "text-sky-600", bg: "bg-sky-50" },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100 p-4 group">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", stat.bg, stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="ds-label">{stat.label}</p>
                <h4 className="ds-stat-medium">{stat.val}</h4>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbox */}
      <Card className="border-none shadow-sm ring-1 ring-slate-100 p-3 bg-white/60 backdrop-blur-xl mb-6">
        <div className="flex flex-col lg:flex-row gap-3 items-center">
          <div className="relative flex-1 group w-full">
            <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search shop, owner, email, or phone..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-xs font-semibold text-slate-700 outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 w-full lg:w-auto">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All Categories" : c}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold transition-all",
                  showFilters ? "bg-slate-900 text-white ring-slate-900" : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <HiOutlineFunnel className="h-4 w-4" />
                <span>More</span>
              </button>
              {showFilters && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-600">Min Revenue (₹)</label>
                      <input
                        type="number"
                        value={advancedFilters.minRevenue}
                        onChange={(e) =>
                          setAdvancedFilters({ ...advancedFilters, minRevenue: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border-none rounded-lg text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-600">Min Rating</label>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="0.1"
                        value={advancedFilters.minRating}
                        onChange={(e) =>
                          setAdvancedFilters({ ...advancedFilters, minRating: e.target.value })
                        }
                        className="w-full accent-primary"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAdvancedFilters({ minRevenue: 0, minRating: 0 });
                        setFilterCategory("all");
                        setFilterStatus("all");
                        setSearchTerm("");
                      }}
                      className="w-full py-2 text-[10px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg"
                    >
                      RESET FILTERS
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Table — desktop */}
      <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="ds-table-header-cell px-6">Supplier</th>
                <th className="ds-table-header-cell px-6">Contact</th>
                <th className="ds-table-header-cell px-6">Coverage</th>
                <th className="ds-table-header-cell px-6">Products</th>
                <th className="ds-table-header-cell px-6">Performance</th>
                <th className="ds-table-header-cell px-6">Verification</th>
                <th className="ds-table-header-cell px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="h-10 w-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-500 font-bold text-sm">Loading suppliers...</p>
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400 font-bold">
                    NO SUPPLIERS MATCH YOUR FILTERS
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => {
                  const isExpanded = expandedSellerId === s._id;
                  return (
                  <React.Fragment key={s._id}>
                  <tr
                    className={cn(
                      "transition-colors cursor-pointer",
                      isExpanded ? "bg-violet-50/40" : "hover:bg-slate-50/30",
                    )}
                    onClick={() => toggleSellerProducts(s._id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 text-left group/name">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSellerProducts(s._id);
                          }}
                          className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all",
                            isExpanded ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500 hover:bg-violet-50",
                          )}
                          aria-expanded={isExpanded}
                          title={isExpanded ? "Hide products" : "Show products"}
                        >
                          <HiOutlineChevronDown
                            className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
                          />
                        </button>
                        <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover/name:ring-2 group-hover/name:ring-primary/20 shrink-0">
                          <HiOutlineBuildingOffice2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 group-hover/name:text-primary">{s.shopName}</p>
                          <p className="text-[10px] text-slate-500">{s.name} · {s.category}</p>
                          <p className="text-[9px] font-bold text-violet-600 mt-0.5">
                            {isExpanded ? "Click row to collapse" : "Click row to view products"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <HiOutlineEnvelope className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate max-w-[180px]">{s.email || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                          <HiOutlinePhone className="h-3.5 w-3.5 text-slate-400" />
                          {s.phone || "—"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1 text-slate-600">
                          <HiOutlineMapPin className="h-3.5 w-3.5" />
                          {s.locationText}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">{s.serviceRadius} km radius</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs space-y-1">
                        <p className="font-black text-slate-900">
                          {s.productCount} listing{s.productCount !== 1 ? 's' : ''}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {s.productStats?.activeProducts ?? 0} active · {s.productStats?.pendingProducts ?? 0} pending
                        </p>
                        <p className="text-[10px] font-bold text-violet-600">
                          {s.productStats?.totalStock ?? 0} units in stock
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1 text-amber-600 font-bold">
                          <HiOutlineStar className="h-3.5 w-3.5 fill-current" />
                          {s.rating.toFixed(1)}
                        </div>
                        <p className="text-slate-600">{s.totalOrders} orders</p>
                        <p className="text-emerald-600 font-bold">₹{(s.revenue / 1000).toFixed(1)}k</p>
                      </div>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-2">
                        {statusBadge(s)}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleStatus(s)}
                            className={cn(
                              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                              s.isActive ? "bg-emerald-500" : "bg-slate-300",
                            )}
                          >
                            <span
                              className={cn(
                                "inline-flex h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm",
                                s.isActive ? "translate-x-4" : "translate-x-1",
                              )}
                            >
                              {s.isActive && <Check className="text-emerald-500 h-2.5 w-2.5 m-auto" />}
                            </span>
                          </button>
                          <span className="text-[10px] font-bold uppercase text-slate-500">
                            {s.isActive ? "On" : "Off"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetail(s)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                          title="Quick view"
                        >
                          <HiOutlineEye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        {s.isVerified && (
                          <button
                            type="button"
                            onClick={() => openRequest(s)}
                            className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            Send PR
                          </button>
                        )}
                        {!s.isVerified && (
                          <>
                            <button
                              type="button"
                              disabled={processingId === s._id}
                              onClick={() => handleApprove(s._id)}
                              className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-emerald-600 text-white"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={processingId === s._id}
                              onClick={() => handleReject(s._id)}
                              className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-rose-600 text-white"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <SellerProductsExpandPanel
                          sellerId={s._id}
                          sellerName={s.shopName}
                          onClose={() => setExpandedSellerId(null)}
                        />
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <Card className="p-8 text-center text-slate-500">Loading...</Card>
        ) : filteredSuppliers.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">No suppliers found</Card>
        ) : (
          filteredSuppliers.map((s) => {
            const isExpanded = expandedSellerId === s._id;
            return (
            <Card key={s._id} className="p-4 border-none ring-1 ring-slate-100 overflow-hidden">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => toggleSellerProducts(s._id)}
              >
              <div className="flex justify-between items-start gap-2 mb-3">
                <div className="flex items-start gap-2">
                  <HiOutlineChevronDown
                    className={cn("h-5 w-5 text-violet-600 shrink-0 mt-0.5 transition-transform", isExpanded && "rotate-180")}
                  />
                  <div>
                    <p className="font-bold text-slate-900">{s.shopName}</p>
                    <p className="text-xs text-slate-500">{s.name}</p>
                    <p className="text-[10px] font-bold text-violet-600 mt-1">
                      {s.productCount} products · tap to {isExpanded ? "hide" : "view"}
                    </p>
                  </div>
                </div>
                {statusBadge(s)}
              </div>
              </button>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-3">
                <span>{s.email}</span>
                <span>{s.phone}</span>
                <span>{s.locationText}</span>
                <span>{s.serviceRadius} km</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openDetail(s)} className="text-xs font-bold text-primary">
                  View
                </button>
                <button type="button" onClick={() => openEdit(s)} className="text-xs font-bold text-slate-600">
                  Edit
                </button>
                {s.isVerified ? (
                  <button type="button" onClick={() => openRequest(s)} className="text-xs font-bold text-emerald-600">
                    Send PR
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => handleApprove(s._id)} className="text-xs font-bold text-emerald-600">
                      Approve
                    </button>
                    <button type="button" onClick={() => handleReject(s._id)} className="text-xs font-bold text-rose-600">
                      Reject
                    </button>
                  </>
                )}
              </div>
              {isExpanded && (
                <div className="-mx-4 -mb-4 mt-3 border-t border-violet-100">
                  <SellerProductsExpandPanel
                    sellerId={s._id}
                    sellerName={s.shopName}
                    onClose={() => setExpandedSellerId(null)}
                  />
                </div>
              )}
            </Card>
          );
          })
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {isDetailOpen && viewingSupplier && (
          <div className="fixed inset-0 z-[100] overflow-y-auto">
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={() => setIsDetailOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-2xl relative z-10 bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{viewingSupplier.shopName}</h2>
                    <p className="text-sm text-slate-500 mt-1">{viewingSupplier.name} · {viewingSupplier.category}</p>
                    <div className="mt-2">{statusBadge(viewingSupplier)}</div>
                  </div>
                  <button type="button" onClick={() => setIsDetailOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <HiOutlineXMark className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6 grid md:grid-cols-2 gap-6">
                  <div className="space-y-3 text-sm">
                    <p className="flex items-center gap-2"><HiOutlineEnvelope className="text-slate-400" />{viewingSupplier.email}</p>
                    <p className="flex items-center gap-2"><HiOutlinePhone className="text-slate-400" />{viewingSupplier.phone}</p>
                    <p className="flex items-center gap-2"><HiOutlineMapPin className="text-slate-400" />{viewingSupplier.locationText}</p>
                    <p className="text-slate-500">Service radius: <strong>{viewingSupplier.serviceRadius} km</strong></p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Rating</p>
                      <p className="text-lg font-bold">{viewingSupplier.rating.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Orders</p>
                      <p className="text-lg font-bold">{viewingSupplier.totalOrders}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Supply Revenue</p>
                      <p className="text-lg font-bold text-emerald-700">₹{viewingSupplier.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/suppliers/${viewingSupplier._id}`)}
                    className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl"
                  >
                    Full Profile
                  </button>
                  <button type="button" onClick={() => { setIsDetailOpen(false); openEdit(viewingSupplier); }} className="px-4 py-2 text-xs font-bold border rounded-xl">
                    Edit
                  </button>
                  {viewingSupplier.isVerified && (
                    <button type="button" onClick={() => { setIsDetailOpen(false); openRequest(viewingSupplier); }} className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl">
                      Send Purchase Request
                    </button>
                  )}
                  {!viewingSupplier.isVerified && (
                    <>
                      <button type="button" onClick={() => handleApprove(viewingSupplier._id)} className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl flex items-center gap-1">
                        <HiOutlineCheck className="h-4 w-4" /> Approve
                      </button>
                      <button type="button" onClick={() => handleReject(viewingSupplier._id)} className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl flex items-center gap-1">
                        <HiOutlineXCircle className="h-4 w-4" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <SupplyFormModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Supplier"
        submitLabel="Create"
        fields={[
          { key: "shopName", label: "Shop Name" },
          { key: "name", label: "Owner Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "password", label: "Password (min 6 chars)" },
          { key: "category", label: "Category", type: "select", options: ["Grocery", "Electronics", "Dairy", "Fruits & Veggies", "General"] },
          { key: "lat", label: "Latitude (optional)" },
          { key: "lng", label: "Longitude (optional)" },
          { key: "radius", label: "Service Radius (km)", type: "number" },
          { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
        ]}
        values={vendorForm}
        onChange={(key, value) => setVendorForm((prev) => ({ ...prev, [key]: value }))}
        onSubmit={addSupplier}
      />

      <SupplyFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Supplier${currentSupplier ? ` — ${currentSupplier.shopName}` : ""}`}
        submitLabel="Save"
        fields={[
          { key: "shopName", label: "Shop Name" },
          { key: "name", label: "Owner Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "password", label: "New Password (optional)" },
          { key: "category", label: "Category", type: "select", options: ["Grocery", "Electronics", "Dairy", "Fruits & Veggies", "General"] },
          { key: "lat", label: "Latitude" },
          { key: "lng", label: "Longitude" },
          { key: "radius", label: "Service Radius (km)", type: "number" },
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
        title={`Purchase Request${currentSupplier ? ` — ${currentSupplier.shopName}` : ""}`}
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
                {sellerProductsLoading
                  ? "Seller product (loading…)"
                  : `Seller product (${sellerProducts.length} listed)`}
              </span>
              <select
                value={requestForm.productId}
                onChange={(e) => {
                  const productId = e.target.value;
                  setRequestForm((prev) => ({ ...prev, productId }));
                  fetchProductPurchaseRequests(productId);
                }}
                disabled={sellerProductsLoading}
                className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none"
              >
                <option value="">
                  {sellerProducts.length
                    ? "Select a product from this seller"
                    : "No products listed by this seller"}
                </option>
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
                <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">Notes (optional)</span>
                <input
                  type="text"
                  value={requestForm.notes}
                  onChange={(e) =>
                    setRequestForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Pickup timing, urgency…"
                  className="mt-1 w-full px-4 py-3 bg-slate-100 rounded-xl text-sm outline-none"
                />
              </label>
            </div>
          </div>
        </div>
      </Modal>

      <SupplyInfoModal isOpen={infoOpen} onClose={() => setInfoOpen(false)} title="Notice" message={infoMessage} />
    </div>
  );
};

export default SuppliersManagementPage;
