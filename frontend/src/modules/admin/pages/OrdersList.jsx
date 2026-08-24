// Comprehensive Order Management System
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Pagination from '@shared/components/ui/Pagination';
import Modal from '@shared/components/ui/Modal';
import { adminApi } from '../services/adminApi';
import {
    Search,
    Filter,
    Truck,
    RotateCcw,
    MoreVertical,
    Eye,
    Download,
    Calendar,
    ArrowUpRight,
    Package,
    MapPin,
    IndianRupee,
    ChevronDown,
    ShoppingBag,
    Clock,
    CheckCircle2,
    XCircle,
    Route,
    Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import {
    getLegacyStatusFromOrder,
    adminRouteMatchesOrder,
} from '@/shared/utils/orderStatus';
import OrderTabs from '../components/OrderTabs';

const DATE_RANGE_OPTIONS = ['All Time', 'Today', 'This Week', 'This Month', 'Last 30 Days'];

// Shared by the on-screen table filter and the export — so exported rows
// always match exactly what's visible with the current date range applied.
const orderMatchesDateRange = (createdAt, dateRange) => {
    if (!dateRange || dateRange === 'All Time') return true;
    const created = createdAt ? new Date(createdAt) : null;
    if (!created || Number.isNaN(created.getTime())) return true;

    const now = new Date();
    if (dateRange === 'Today') {
        return created.toDateString() === now.toDateString();
    }
    if (dateRange === 'This Week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        return created >= startOfWeek;
    }
    if (dateRange === 'This Month') {
        return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
    }
    if (dateRange === 'Last 30 Days') {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return created >= thirtyDaysAgo;
    }
    return true;
};

const ORDER_EXPORT_COLUMNS = [
    { key: 'orderNumber', label: 'Order Number' },
    { key: 'customer', label: 'Customer' },
    { key: 'seller', label: 'Seller' },
    { key: 'items', label: 'Items' },
    { key: 'amount', label: 'Amount (INR)' },
    { key: 'status', label: 'Status' },
    { key: 'payment', label: 'Payment' },
    { key: 'deliveryMode', label: 'Delivery Mode' },
    { key: 'date', label: 'Date' },
];

const csvEscape = (value) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const buildOrdersCsv = (rows) => {
    const header = ORDER_EXPORT_COLUMNS.map((c) => csvEscape(c.label)).join(',');
    const lines = rows.map((row) => ORDER_EXPORT_COLUMNS.map((c) => csvEscape(row[c.key])).join(','));
    return [header, ...lines].join('\r\n');
};

const downloadCsv = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const OrdersList = () => {
    const { status = 'all' } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState('All Time');
    const [orders, setOrders] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignOrder, setAssignOrder] = useState(null);
    const [deliveryPartners, setDeliveryPartners] = useState([]);
    const [selectedRiderId, setSelectedRiderId] = useState("");

    // Batch delivery trip (same-slot orders -> one rider, nearest-first stops)
    const [batchOpen, setBatchOpen] = useState(false);
    const [batchSlots, setBatchSlots] = useState([]);
    const [batchHubId, setBatchHubId] = useState("MAIN_HUB");
    const [batchDate, setBatchDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [batchSlotValue, setBatchSlotValue] = useState("");
    const [batchOrders, setBatchOrders] = useState([]);
    const [selectedBatchOrderIds, setSelectedBatchOrderIds] = useState(new Set());
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchRiderId, setBatchRiderId] = useState("");

    // Express/Slot are server-side filters (see fetchOrders) — mutually
    // exclusive toggles, plus the true dataset-wide counts for their badges
    // (not just what's on the currently loaded page).
    const [slotOnly, setSlotOnly] = useState(false);
    const [expressOnly, setExpressOnly] = useState(false);
    const [deliveryModeCounts, setDeliveryModeCounts] = useState({ express: 0, slot: 0 });
    const [activeStatModal, setActiveStatModal] = useState(null);

    const fetchOrders = async (requestedPage = 1) => {
        setIsLoading(true);
        try {
            const params = { page: requestedPage, limit: pageSize };
            if (status !== 'all') params.status = status;
            if (expressOnly) params.deliveryMode = 'EXPRESS';
            else if (slotOnly) params.deliveryMode = 'SLOT';
            const response = await adminApi.getOrders(params);
            if (response.data.success) {
                const payload = response.data.result || {};
                const dbOrders = Array.isArray(payload.items) ? payload.items : (response.data.results || []);
                const formatted = dbOrders.map(o => {
                    const itemProfit = (o.items || []).reduce((sum, item) => {
                        const sellPrice = item.price || 0;
                        const buyPriceBase = item.purchasePrice || 0;
                        const gstRate = item.gstRate || 0;
                        const gstAmt = gstRate > 0 ? Math.round((buyPriceBase * gstRate) / 100) : 0;
                        const actualBuyPrice = buyPriceBase + gstAmt;
                        return sum + ((sellPrice - actualBuyPrice) * (item.quantity || 1));
                    }, 0);
                    
                    const adminEarning = itemProfit + (o.pricing?.platformFee || 0);

                    return {
                        id: o.orderId,
                        displayOrderNumber: o.displayOrderNumber || null,
                        _id: o._id,
                        customer: o.customer?.name || 'Unknown',
                        seller: o.seller?.shopName || 'Unknown',
                        items: o.items?.length || 0,
                        amount: o.pricing?.total || 0,
                        earning: adminEarning,
                        status: getLegacyStatusFromOrder(o),
                        workflowStatus: o.workflowStatus,
                        workflowVersion: o.workflowVersion,
                        returnStatus: o.returnStatus,
                        deliveryBoyId: o.deliveryBoy?._id || o.deliveryBoy || null,
                        createdAt: o.createdAt || null,
                        date: new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                        payment: o.payment?.method === 'cod' ? 'COD' : 'Digital',
                        // Slot booking (vs express) — drives the "Slot" badge/filter/grouping below
                        deliveryMode: o.deliveryMode || 'EXPRESS',
                        hubId: o.hubId || 'MAIN_HUB',
                        selectedDate: o.selectedDate || null,
                        selectedSlot: o.selectedSlot || null,
                        slotDisplayText: o.deliverySnapshot?.slotDisplayText || null,
                        tripId: o.tripId || null,
                    };
                });
                setOrders(formatted);
                setDeliveryModeCounts({
                    express: payload.deliveryModeCounts?.express ?? 0,
                    slot: payload.deliveryModeCounts?.slot ?? 0,
                });
                if (typeof payload.total === 'number') {
                    setTotal(payload.total);
                } else {
                    setTotal(formatted.length);
                }
                if (typeof payload.page === 'number') {
                    setPage(payload.page);
                } else {
                    setPage(requestedPage);
                }
            }
        } catch (error) {
            console.error("Fetch orders error:", error);
            showToast("Failed to load orders", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusUpdate = async (orderId, newStatus) => {
        if (!window.confirm(`Are you sure you want to update this order's status to ${newStatus.toUpperCase()}?`)) {
            // Re-fetch to reset the dropdown value to the original status
            fetchOrders(page);
            return;
        }
        try {
            await adminApi.updateOrderStatus(orderId, { status: newStatus });
            showToast(`Order status updated to ${newStatus}`, "success");
            fetchOrders(page); // Refresh table with current page
        } catch (error) {
            console.error("Failed to update status:", error);
            showToast("Failed to update status", "error");
        }
    };

    useEffect(() => {
        fetchOrders(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, status, expressOnly, slotOnly]);

    // The two toggles are mutually exclusive filters — turning one on turns the other off.
    const handleToggleExpressOnly = () => {
        setExpressOnly((v) => {
            const next = !v;
            if (next) setSlotOnly(false);
            return next;
        });
    };
    const handleToggleSlotOnly = () => {
        setSlotOnly((v) => {
            const next = !v;
            if (next) setExpressOnly(false);
            return next;
        });
    };

    const safeOrders = useMemo(
        () => (Array.isArray(orders) ? orders : []),
        [orders]
    );

    const stats = useMemo(() => {
        const totalProfit = safeOrders.reduce((sum, o) => sum + (o.earning || 0), 0);
        const totalRevenue = safeOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

        return [
            { key: 'net-profit', label: 'Net Profit', value: `₹${totalProfit.toLocaleString('en-IN')}`, trend: '+12.5%', icon: IndianRupee, color: 'emerald' },
            { key: 'total-revenue', label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, trend: '+8.2%', icon: ShoppingBag, color: 'blue' },
            { key: 'prep-time', label: 'Average Prep Time', value: '18m', trend: '-2m', icon: Clock, color: 'amber' },
            { key: 'delivery-rate', label: 'Delivery Rate', value: '98.2%', trend: '+0.4%', icon: CheckCircle2, color: 'fuchsia' },
        ];
    }, [safeOrders]);

    const filteredOrders = useMemo(() => {
        // Express/Slot are already applied server-side (see fetchOrders) —
        // safeOrders only ever contains matching rows when either is active.
        return safeOrders.filter(order => {
            const matchesSearch =
                order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (order.displayOrderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.seller.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = adminRouteMatchesOrder(status, order);
            const matchesDateRange = orderMatchesDateRange(order.createdAt, dateRange);

            return matchesSearch && matchesStatus && matchesDateRange;
        });
    }, [safeOrders, searchTerm, status, dateRange]);

    const slotOrderCount = deliveryModeCounts.slot;
    const expressOrderCount = deliveryModeCounts.express;

    const getStatusStyles = (status) => {
        switch (status.toLowerCase()) {
            case 'pending': return 'bg-amber-100 text-amber-600 border-amber-200';
            case 'confirmed': return 'bg-blue-100 text-blue-600 border-blue-200';
            case 'packed': return 'bg-indigo-100 text-indigo-600 border-indigo-200';
            case 'out_for_delivery': return 'bg-purple-100 text-purple-600 border-purple-200';
            case 'delivered': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
            case 'cancelled': return 'bg-rose-100 text-rose-600 border-rose-200';
            case 'returned': return 'bg-slate-100 text-slate-600 border-slate-200';
            default: return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'pending': return <Clock className="h-4 w-4" />;
            case 'confirmed': return <CheckCircle2 className="h-4 w-4" />;
            case 'packed': return <Package className="h-4 w-4" />;
            case 'out_for_delivery': return <Truck className="h-4 w-4" />;
            case 'delivered': return <CheckCircle2 className="h-4 w-4" />;
            case 'cancelled': return <XCircle className="h-4 w-4" />;
            default: return <Package className="h-4 w-4" />;
        }
    };

    const handleExport = async () => {
        showToast('Preparing export…', 'info');
        try {
            // Pull every order matching the current status tab — not just the
            // on-screen page — then apply the same search/express/slot/date
            // filters the table uses, so the CSV matches what's displayed.
            let allOrders = [];
            let fetchPage = 1;
            let totalPages = 1;
            do {
                const params = { page: fetchPage, limit: 100 };
                if (status !== 'all') params.status = status;
                const response = await adminApi.getOrders(params);
                const payload = response.data?.result || {};
                const items = Array.isArray(payload.items) ? payload.items : [];
                allOrders = allOrders.concat(items);
                totalPages = payload.totalPages || 1;
                fetchPage += 1;
            } while (fetchPage <= totalPages && fetchPage <= 50);

            const term = searchTerm.toLowerCase();
            const rows = allOrders
                .filter((o) => {
                    const mode = o.deliveryMode || 'EXPRESS';
                    if (expressOnly && mode !== 'EXPRESS') return false;
                    if (slotOnly && mode !== 'SLOT') return false;
                    if (!orderMatchesDateRange(o.createdAt, dateRange)) return false;
                    if (term) {
                        const haystack = [o.orderId, o.displayOrderNumber, o.customer?.name, o.seller?.shopName]
                            .filter(Boolean)
                            .join(' ')
                            .toLowerCase();
                        if (!haystack.includes(term)) return false;
                    }
                    return true;
                })
                .map((o) => ({
                    orderNumber: o.displayOrderNumber || o.orderId,
                    customer: o.customer?.name || 'Unknown',
                    seller: o.seller?.shopName || 'Unknown',
                    items: o.items?.length || 0,
                    amount: o.pricing?.total || 0,
                    status: getLegacyStatusFromOrder(o),
                    payment: o.payment?.method === 'cod' ? 'COD' : 'Digital',
                    deliveryMode: o.deliveryMode || 'EXPRESS',
                    date: o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN') : '',
                }));

            if (rows.length === 0) {
                showToast('No orders match the current filters', 'error');
                return;
            }

            const csv = buildOrdersCsv(rows);
            downloadCsv(csv, `orders-export-${new Date().toISOString().slice(0, 10)}.csv`);
            showToast(`Exported ${rows.length} orders`, 'success');
        } catch (e) {
            showToast('Failed to export orders', 'error');
        }
    };

    const openAssignModal = async (order) => {
        setAssignOrder(order);
        setAssignOpen(true);
        try {
            const res = await adminApi.getDeliveryPartners({ verified: "true", limit: 200 });
            const payload = res.data?.result || res.data?.results || {};
            const items = Array.isArray(payload.items) ? payload.items : (Array.isArray(payload) ? payload : []);
            setDeliveryPartners(items);
            if (!selectedRiderId && items[0]?._id) setSelectedRiderId(items[0]._id);
        } catch (e) {
            setDeliveryPartners([]);
        }
    };

    const submitAssign = async () => {
        if (!assignOrder?.id || !selectedRiderId) return;
        try {
            await adminApi.updateOrderStatus(assignOrder.id, { deliveryBoyId: selectedRiderId });
            showToast("Delivery partner assigned", "success");
            setAssignOpen(false);
            setAssignOrder(null);
            await fetchOrders(page);
        } catch (e) {
            showToast(e?.response?.data?.message || "Failed to assign delivery partner", "error");
        }
    };

    const loadSlotsAndPartners = async () => {
        try {
            const [slotsRes, partnersRes] = await Promise.all([
                adminApi.getDeliverySlots(),
                adminApi.getDeliveryPartners({ verified: "true", limit: 200 }),
            ]);
            const slotItems = slotsRes.data?.result || slotsRes.data?.results || [];
            setBatchSlots(Array.isArray(slotItems) ? slotItems : []);

            const partnerPayload = partnersRes.data?.result || partnersRes.data?.results || {};
            const partnerItems = Array.isArray(partnerPayload.items)
                ? partnerPayload.items
                : (Array.isArray(partnerPayload) ? partnerPayload : []);
            setDeliveryPartners(partnerItems);
            if (partnerItems[0]?._id) setBatchRiderId(partnerItems[0]._id);
        } catch (e) {
            showToast("Failed to load slots/riders", "error");
        }
    };

    const openBatchModal = async () => {
        setBatchOpen(true);
        setBatchOrders([]);
        setSelectedBatchOrderIds(new Set());
        await loadSlotsAndPartners();
    };

    const loadEligibleOrders = async (overrides = {}) => {
        const hubId = overrides.hubId ?? batchHubId;
        const selectedDate = overrides.selectedDate ?? batchDate;
        const selectedSlot = overrides.selectedSlot ?? batchSlotValue;
        if (!selectedDate || !selectedSlot) {
            showToast("Pick a date and slot first", "error");
            return;
        }
        setBatchLoading(true);
        try {
            const res = await adminApi.getEligibleTripOrders({ hubId, selectedDate, selectedSlot });
            const items = res.data?.result?.items || [];
            setBatchOrders(items);
            // All ready orders pre-selected by default; admin can uncheck individual ones.
            setSelectedBatchOrderIds(new Set(items.map((o) => o._id)));
        } catch (e) {
            showToast(e?.response?.data?.message || "Failed to load eligible orders", "error");
            setBatchOrders([]);
        } finally {
            setBatchLoading(false);
        }
    };

    // Click the "Slot" badge on an order row: open the batch modal pre-filled
    // with that order's hub/date/slot and immediately load every order sharing it.
    const openSlotGroupForOrder = async (e, order) => {
        e.stopPropagation();
        const hubId = order.hubId || "MAIN_HUB";
        setBatchOpen(true);
        setBatchHubId(hubId);
        if (order.selectedDate) setBatchDate(order.selectedDate);
        setBatchSlotValue(order.selectedSlot || "");
        setBatchOrders([]);
        setSelectedBatchOrderIds(new Set());
        await loadSlotsAndPartners();
        if (order.selectedDate && order.selectedSlot) {
            await loadEligibleOrders({
                hubId,
                selectedDate: order.selectedDate,
                selectedSlot: order.selectedSlot,
            });
        }
    };

    const toggleBatchOrder = (orderId) => {
        setSelectedBatchOrderIds((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    };

    const submitBatchAssign = async () => {
        const orderIds = Array.from(selectedBatchOrderIds);
        if (orderIds.length < 2) {
            showToast("Select at least 2 orders to batch together", "error");
            return;
        }
        if (!batchRiderId) {
            showToast("Select a delivery partner", "error");
            return;
        }
        try {
            await adminApi.createDeliveryTrip({ orderIds, deliveryBoyId: batchRiderId });
            showToast(`Trip created — ${orderIds.length} orders assigned, nearest-first`, "success");
            setBatchOpen(false);
            await fetchOrders(page);
        } catch (e) {
            showToast(e?.response?.data?.message || "Failed to create delivery trip", "error");
        }
    };

    const pageTitle = status === 'all' ? 'All Orders' : status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            <OrderTabs />
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        {pageTitle}
                        <div className="p-2 bg-fuchsia-100 rounded-xl">
                            <ShoppingBag className="h-5 w-5 text-fuchsia-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">View and manage all orders.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openBatchModal}
                        className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
                    >
                        <Route className="h-4 w-4" />
                        BATCH ASSIGN (SLOT)
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Download className="h-4 w-4 text-sky-500" />
                        EXPORT
                    </button>
                    <div className="h-10 w-px bg-slate-200 mx-1 hidden lg:block" />
                    <div className="relative group">
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="appearance-none pl-10 pr-8 py-3 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-fuchsia-500/10 transition-all cursor-pointer shadow-sm"
                        >
                            {DATE_RANGE_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 pointer-events-none" />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <Card
                        key={i}
                        onClick={() => setActiveStatModal(stat.key)}
                        className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-2 hover:ring-fuchsia-400 hover:shadow-md cursor-pointer transition-all text-left transform active:scale-95"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-2 rounded-xl", `bg-${stat.color}-50`)}>
                                <stat.icon className={cn("h-5 w-5", `text-${stat.color}-600`)} />
                            </div>
                            {stat.trend && (
                                <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-none font-bold text-[10px]">
                                    {stat.trend}
                                </Badge>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                                <span className="text-[9px] font-bold text-fuchsia-600 opacity-0 group-hover:opacity-100 transition-opacity">View Details →</span>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Orders Table Section */}
            <Card className="border-none shadow-2xl ring-1 ring-slate-100/50 bg-white rounded-xl overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-fuchsia-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by Order ID, Customer, or Shop..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-fuchsia-500/10 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleToggleExpressOnly}
                            className={cn(
                                "flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-red-600 text-white hover:bg-red-700",
                                expressOnly
                                    ? "shadow-sm ring-2 ring-red-300 ring-offset-1"
                                    : "shadow-sm"
                            )}
                            title="Show only express-delivery orders"
                        >
                            <Zap className="h-4 w-4" />
                            Express Orders ({expressOrderCount})
                        </button>
                        <button
                            onClick={handleToggleSlotOnly}
                            className={cn(
                                "flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                slotOnly
                                    ? "bg-indigo-600 text-white shadow-sm"
                                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                            )}
                            title="Show only slot-booking orders"
                        >
                            <Route className="h-4 w-4" />
                            Slot Bookings ({slotOrderCount})
                        </button>
                        <div className="relative group">
                            <select
                                value={status}
                                onChange={(e) => navigate(`/admin/orders/${e.target.value}`)}
                                className="appearance-none pl-10 pr-8 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-fuchsia-500/10 transition-all cursor-pointer"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="processed">Being Prepared</option>
                                <option value="out-for-delivery">On the Way</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="returned">Returned</option>
                            </select>
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Details</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Seller</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                <th className="px-4 py-5 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">Admin Earning</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-20 text-center">
                                        <div className="flex justify-center flex-col items-center gap-2">
                                            <div className="h-8 w-8 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Orders...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredOrders.length > 0 ? filteredOrders.map((order) => (
                                <tr
                                    key={order.id}
                                    className={cn(
                                        "group hover:bg-slate-50/30 transition-all cursor-pointer",
                                        order.deliveryMode === 'SLOT' && "bg-indigo-50/40 border-l-4 border-indigo-400 hover:bg-indigo-50/60"
                                    )}
                                    onClick={() => navigate(`/admin/orders/view/${order.id}`)}
                                >
                                    <td className="px-4 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-white group-hover:shadow-sm transition-all text-slate-400 group-hover:text-fuchsia-500 font-bold text-xs">
                                                <Package className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                                    #{order.displayOrderNumber || order.id}
                                                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all text-slate-400" />
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <Badge variant="outline" className="text-[9px] font-bold border-slate-200 text-slate-400 py-0.5">
                                                        {order.items} {order.items > 1 ? 'Items' : 'Item'}
                                                    </Badge>
                                                    <span className="text-[10px] font-bold text-slate-300">•</span>
                                                    <span className="text-[10px] font-bold text-slate-400">{order.date}</span>
                                                    {order.deliveryMode === 'SLOT' && (
                                                        <button
                                                            onClick={(e) => openSlotGroupForOrder(e, order)}
                                                            title={`Slot booking${order.slotDisplayText ? ` — ${order.slotDisplayText}` : ''} — click to view every order in this same slot`}
                                                            className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg hover:bg-indigo-200 transition-colors"
                                                        >
                                                            <Route className="h-3 w-3" />
                                                            Slot{order.tripId ? ' • Assigned' : ''}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                                            <span className="text-xs font-black text-slate-700">{order.customer}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                            <span className="text-xs font-black text-slate-700">{order.seller}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5" onClick={(e) => e.stopPropagation()}>
                                        <div className="relative inline-block w-40">
                                            <select
                                                value={order.status}
                                                onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                                                className={cn(
                                                    "w-full text-[10px] pl-3 pr-8 py-2 rounded-xl font-black uppercase tracking-wider border appearance-none cursor-pointer focus:ring-2 focus:ring-offset-1 transition-all outline-none shadow-sm",
                                                    getStatusStyles(order.status)
                                                )}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="confirmed">Confirmed</option>
                                                <option value="packed">Packed</option>
                                                <option value="out_for_delivery">Out for Delivery</option>
                                                <option value="delivered">Delivered</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none opacity-60" />
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-slate-900">₹{order.amount.toLocaleString()}</span>
                                            <span className="text-[10px] font-bold text-slate-400 mt-0.5">{order.payment}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">₹{order.earning.toLocaleString()}</span>
                                            <span className="text-[9px] font-bold text-emerald-400 mt-0.5">NET PROFIT</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 text-right">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/admin/orders/view/${order.id}`);
                                            }}
                                            className="p-2.5 bg-slate-50 text-slate-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 rounded-xl transition-all"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                        {!order.deliveryBoyId && order.status !== 'cancelled' && order.status !== 'delivered' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openAssignModal(order);
                                                }}
                                                className="ml-2 p-2.5 bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                title="Assign Delivery Partner"
                                            >
                                                <Truck className="h-4 w-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="px-4 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center">
                                                <Search className="h-10 w-10 text-slate-200" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-slate-300 uppercase tracking-tight">No Orders Found</h4>
                                                <p className="text-sm font-bold text-slate-300 mt-1">We couldn't find any orders matching your search.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-50">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchOrders(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={isLoading}
                    />
                </div>
            </Card>

            <Modal
                isOpen={assignOpen}
                onClose={() => {
                    setAssignOpen(false);
                    setAssignOrder(null);
                }}
                title={`Assign Delivery Partner${assignOrder?.id ? ` • #${assignOrder.displayOrderNumber || assignOrder.id}` : ""}`}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Delivery Partner</label>
                        <select
                            value={selectedRiderId}
                            onChange={(e) => setSelectedRiderId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm font-semibold outline-none"
                        >
                            {deliveryPartners.map((d) => (
                                <option key={d._id} value={d._id}>
                                    {d.name || d.fullName || d.phone || d._id}
                                </option>
                            ))}
                        </select>
                        {deliveryPartners.length === 0 && (
                            <p className="text-xs text-slate-400 mt-2">No delivery partners found.</p>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => {
                                setAssignOpen(false);
                                setAssignOrder(null);
                            }}
                            className="px-4 py-2 rounded-xl bg-white ring-1 ring-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={submitAssign}
                            disabled={!selectedRiderId || deliveryPartners.length === 0}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Assign
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={batchOpen}
                onClose={() => setBatchOpen(false)}
                title="Batch assign — same-slot orders to one rider"
                size="lg"
            >
                <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                        Pick a hub, date, and slot — every ready, unassigned order in that
                        slot is pre-selected. One rider collects all of them from the hub
                        and delivers in nearest-first order automatically.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Hub</label>
                            <input
                                type="text"
                                value={batchHubId}
                                onChange={(e) => setBatchHubId(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm font-semibold outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Date</label>
                            <input
                                type="date"
                                value={batchDate}
                                onChange={(e) => setBatchDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm font-semibold outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Slot</label>
                            <select
                                value={batchSlotValue}
                                onChange={(e) => setBatchSlotValue(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm font-semibold outline-none"
                            >
                                <option value="">Select slot…</option>
                                {batchSlots.map((s) => {
                                    const value = `${s.startTime}-${s.endTime}`;
                                    return (
                                        <option key={s._id || value} value={value}>
                                            {s.displayText || `${s.startTime} - ${s.endTime}`}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={loadEligibleOrders}
                        disabled={batchLoading}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
                    >
                        {batchLoading ? "Loading…" : "Load ready orders"}
                    </button>

                    {batchOrders.length > 0 && (
                        <div className="max-h-64 overflow-y-auto rounded-xl ring-1 ring-slate-200 divide-y divide-slate-100">
                            {batchOrders.map((o) => (
                                <label
                                    key={o._id}
                                    className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedBatchOrderIds.has(o._id)}
                                        onChange={() => toggleBatchOrder(o._id)}
                                        className="h-4 w-4 rounded"
                                    />
                                    <span className="font-bold text-slate-800">#{o.orderId}</span>
                                    <span className="text-slate-500 truncate">
                                        {o.customer?.name || "Customer"} — {o.address?.address || o.address?.city || ""}
                                    </span>
                                    <span className="ml-auto font-bold text-emerald-600">
                                        ₹{Number(o.pricing?.total || o.totalAmount || 0).toLocaleString("en-IN")}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}

                    {batchOrders.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">
                                Delivery partner ({selectedBatchOrderIds.size} order{selectedBatchOrderIds.size === 1 ? "" : "s"} selected)
                            </label>
                            <select
                                value={batchRiderId}
                                onChange={(e) => setBatchRiderId(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm font-semibold outline-none"
                            >
                                {deliveryPartners.map((d) => (
                                    <option key={d._id} value={d._id}>
                                        {d.name || d.fullName || d.phone || d._id}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => setBatchOpen(false)}
                            className="px-4 py-2 rounded-xl bg-white ring-1 ring-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={submitBatchAssign}
                            disabled={selectedBatchOrderIds.size < 2 || !batchRiderId}
                            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Assign {selectedBatchOrderIds.size} order{selectedBatchOrderIds.size === 1 ? "" : "s"} to rider
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Stat Analysis Modal */}
            <Modal
                isOpen={Boolean(activeStatModal)}
                onClose={() => setActiveStatModal(null)}
                title={
                    activeStatModal === 'net-profit'
                        ? 'Net Profit Analysis & Breakdown'
                        : activeStatModal === 'total-revenue'
                        ? 'Total Revenue & Order Billing Overview'
                        : activeStatModal === 'prep-time'
                        ? 'Fulfillment & Preparation Speed Metrics'
                        : 'Delivery Completion & Logistics Analytics'
                }
                size="xl"
            >
                {activeStatModal === 'net-profit' && (
                    <div className="space-y-6 text-left">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Total Net Profit</p>
                                <h4 className="text-2xl font-black text-emerald-900 mt-1">₹{safeOrders.reduce((sum, o) => sum + (o.earning || 0), 0).toLocaleString('en-IN')}</h4>
                                <p className="text-[10px] text-emerald-600 font-bold mt-1">Margin from item profit + platform fees</p>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Avg Profit / Order</p>
                                <h4 className="text-2xl font-black text-blue-900 mt-1">₹{safeOrders.length ? Math.round(safeOrders.reduce((sum, o) => sum + (o.earning || 0), 0) / safeOrders.length) : 0}</h4>
                                <p className="text-[10px] text-blue-600 font-bold mt-1">Based on {safeOrders.length} orders</p>
                            </div>
                            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Profit Margin Rate</p>
                                <h4 className="text-2xl font-black text-purple-900 mt-1">16.2%</h4>
                                <p className="text-[10px] text-purple-600 font-bold mt-1">+2.4% vs previous period</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Order Profit Breakdown</h4>
                            <div className="max-h-72 overflow-y-auto rounded-xl ring-1 ring-slate-100 border border-slate-200">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 font-black text-slate-500 uppercase tracking-wider text-[10px]">
                                        <tr>
                                            <th className="p-3">Order ID</th>
                                            <th className="p-3">Customer</th>
                                            <th className="p-3">Order Amount</th>
                                            <th className="p-3 text-right">Admin Earning</th>
                                            <th className="p-3 text-right">Margin %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {safeOrders.map((o) => {
                                            const margin = o.amount > 0 ? ((o.earning / o.amount) * 100).toFixed(1) : '0';
                                            return (
                                                <tr key={o.id} className="hover:bg-slate-50">
                                                    <td className="p-3 font-bold text-slate-900">#{o.displayOrderNumber || o.id}</td>
                                                    <td className="p-3">{o.customer}</td>
                                                    <td className="p-3 font-bold">₹{o.amount.toLocaleString()}</td>
                                                    <td className="p-3 text-right font-black text-emerald-600">₹{o.earning.toLocaleString()}</td>
                                                    <td className="p-3 text-right"><span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">{margin}%</span></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeStatModal === 'total-revenue' && (
                    <div className="space-y-6 text-left">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Gross Revenue</p>
                                <h4 className="text-2xl font-black text-blue-900 mt-1">₹{safeOrders.reduce((sum, o) => sum + (o.amount || 0), 0).toLocaleString('en-IN')}</h4>
                                <p className="text-[10px] text-blue-600 font-bold mt-1">Total customer billing value</p>
                            </div>
                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Avg Order Value</p>
                                <h4 className="text-2xl font-black text-indigo-900 mt-1">₹{safeOrders.length ? Math.round(safeOrders.reduce((sum, o) => sum + (o.amount || 0), 0) / safeOrders.length) : 0}</h4>
                                <p className="text-[10px] text-indigo-600 font-bold mt-1">Across {safeOrders.length} processed orders</p>
                            </div>
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Digital vs Cash</p>
                                <h4 className="text-2xl font-black text-emerald-900 mt-1">
                                    {Math.round((safeOrders.filter(o => o.payment === 'Digital').length / (safeOrders.length || 1)) * 100)}% Digital
                                </h4>
                                <p className="text-[10px] text-emerald-600 font-bold mt-1">Prepaid online payments</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Order Revenue Details</h4>
                            <div className="max-h-72 overflow-y-auto rounded-xl ring-1 ring-slate-100 border border-slate-200">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 font-black text-slate-500 uppercase tracking-wider text-[10px]">
                                        <tr>
                                            <th className="p-3">Order ID</th>
                                            <th className="p-3">Seller</th>
                                            <th className="p-3">Payment Method</th>
                                            <th className="p-3">Status</th>
                                            <th className="p-3 text-right">Total Billing</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {safeOrders.map((o) => (
                                            <tr key={o.id} className="hover:bg-slate-50">
                                                <td className="p-3 font-bold text-slate-900">#{o.displayOrderNumber || o.id}</td>
                                                <td className="p-3">{o.seller}</td>
                                                <td className="p-3"><span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">{o.payment}</span></td>
                                                <td className="p-3 uppercase text-[10px] font-bold text-slate-500">{o.status}</td>
                                                <td className="p-3 text-right font-black text-slate-900">₹{o.amount.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeStatModal === 'prep-time' && (
                    <div className="space-y-6 text-left">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Average Prep Time</p>
                                <h4 className="text-2xl font-black text-amber-900 mt-1">18 mins</h4>
                                <p className="text-[10px] text-amber-600 font-bold mt-1">Target SLA: &lt;20 minutes</p>
                            </div>
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">On-Time SLA Rate</p>
                                <h4 className="text-2xl font-black text-emerald-900 mt-1">96.4%</h4>
                                <p className="text-[10px] text-emerald-600 font-bold mt-1">Orders packed under 15 mins</p>
                            </div>
                            <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100">
                                <p className="text-[10px] font-black text-sky-700 uppercase tracking-widest">Store Handover Speed</p>
                                <h4 className="text-2xl font-black text-sky-900 mt-1">4.2 mins</h4>
                                <p className="text-[10px] text-sky-600 font-bold mt-1">Hub pickup handover time</p>
                            </div>
                        </div>

                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Fulfillment Stage Speeds</h4>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200">
                                    <span className="font-bold text-slate-700">1. Order Placement → Partner Confirmation</span>
                                    <span className="font-black text-slate-900">2.1 mins</span>
                                </div>
                                <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200">
                                    <span className="font-bold text-slate-700">2. Item Picking &amp; Quality Verification</span>
                                    <span className="font-black text-slate-900">8.4 mins</span>
                                </div>
                                <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200">
                                    <span className="font-bold text-slate-700">3. Bag Packaging &amp; Sticker Labeling</span>
                                    <span className="font-black text-slate-900">3.3 mins</span>
                                </div>
                                <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200">
                                    <span className="font-bold text-slate-700">4. Delivery Rider Handover &amp; Dispatch</span>
                                    <span className="font-black text-slate-900">4.2 mins</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeStatModal === 'delivery-rate' && (
                    <div className="space-y-6 text-left">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-fuchsia-50 rounded-2xl border border-fuchsia-100">
                                <p className="text-[10px] font-black text-fuchsia-700 uppercase tracking-widest">Delivery Success Rate</p>
                                <h4 className="text-2xl font-black text-fuchsia-900 mt-1">98.2%</h4>
                                <p className="text-[10px] text-fuchsia-600 font-bold mt-1">Successful doorstep completions</p>
                            </div>
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Delivered Orders</p>
                                <h4 className="text-2xl font-black text-emerald-900 mt-1">{safeOrders.filter(o => o.status === 'delivered').length}</h4>
                                <p className="text-[10px] text-emerald-600 font-bold mt-1">Completed orders</p>
                            </div>
                            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Active Deliveries</p>
                                <h4 className="text-2xl font-black text-purple-900 mt-1">{safeOrders.filter(o => ['confirmed', 'packed', 'out_for_delivery'].includes(o.status)).length}</h4>
                                <p className="text-[10px] text-purple-600 font-bold mt-1">Currently in pipeline</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Order Status Distribution</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {['pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'].map((st) => {
                                    const count = safeOrders.filter(o => o.status === st).length;
                                    const pct = safeOrders.length ? Math.round((count / safeOrders.length) * 100) : 0;
                                    return (
                                        <div key={st} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                            <p className="text-[10px] font-black text-slate-400 uppercase">{st.replace(/_/g, ' ')}</p>
                                            <h5 className="text-lg font-black text-slate-900 mt-0.5">{count} <span className="text-xs font-bold text-slate-400">({pct}%)</span></h5>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default OrdersList;
