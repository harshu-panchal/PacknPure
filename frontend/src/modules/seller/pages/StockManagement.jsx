import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Button from '@shared/components/ui/Button';
import Badge from '@shared/components/ui/Badge';
import Input from '@shared/components/ui/Input';
import Pagination from '@shared/components/ui/Pagination';
import {
    HiOutlineCube,
    HiOutlineExclamationTriangle,
    HiOutlineArchiveBoxXMark,
    HiOutlineArrowsUpDown,
    HiOutlineMagnifyingGlass,
    HiOutlineFunnel,
    HiOutlinePlus,
    HiOutlineMinus,
    HiOutlineArrowPath,
    HiOutlineClipboardDocumentList,
    HiOutlineXMark,
    HiOutlineCheck,
    HiOutlineCalendarDays
} from 'react-icons/hi2';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BlurFade } from '@/components/ui/blur-fade';
import { MagicCard } from '@/components/ui/magic-card';
import { sellerApi } from '../services/sellerApi';
import { toast } from 'sonner';
import { useDebouncedValue, DEBOUNCE_MS } from '@shared/hooks/useDebounce';

const StockManagement = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('inventory'); // 'inventory' or 'history'
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebouncedValue(searchTerm, DEBOUNCE_MS.filter);
    const [filterStatus, setFilterStatus] = useState('All');
    const [inventory, setInventory] = useState([]);
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [adjustType, setAdjustType] = useState('Restock');
    const [adjustValue, setAdjustValue] = useState('');
    const [adjustNote, setAdjustNote] = useState('');
    const [selectedVariantId, setSelectedVariantId] = useState('');

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const fetchInventory = async (silent = false, stockStatus) => {
        if (!silent) setIsLoading(true);
        try {
            const params = {};
            if (stockStatus === 'in') params.stockStatus = 'in';
            if (stockStatus === 'out') params.stockStatus = 'out';

            const res = await sellerApi.getProducts(params);
            if (res.data.success) {
                // Backend returns handleResponse(..., { items, page, limit, total, totalPages })
                const payload = res.data.result || {};
                const rawProducts = Array.isArray(payload.items)
                    ? payload.items
                    : (res.data.results || []);

                const safeProducts = Array.isArray(rawProducts) ? rawProducts : [];

                setInventory(
                    safeProducts.map(p => ({
                        ...p,
                        id: p._id,
                        threshold: p.lowStockAlert || 5,
                        status:
                            p.stock === 0
                                ? 'Out of Stock'
                                : (p.stock <= (p.lowStockAlert || 5) ? 'Low Stock' : 'In Stock')
                    }))
                );
            }
        } catch (error) {
            toast.error("Failed to load inventory");
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const fetchHistory = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await sellerApi.getStockHistory();
            if (res.data.success) {
                setHistory(res.data.result || []);
            }
        } catch (error) {
            toast.error("Failed to load stock history");
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activeView === 'inventory') {
            let stockStatusParam;
            if (filterStatus === 'In Stock') stockStatusParam = 'in';
            else if (filterStatus === 'Out of Stock') stockStatusParam = 'out';
            else stockStatusParam = undefined; // All / Low Stock -> no backend filter
            fetchInventory(false, stockStatusParam);
        } else {
            fetchHistory();
        }
    }, [activeView, filterStatus]);

    const stats = useMemo(() => [
        { label: 'Total Inventory', value: inventory.reduce((acc, item) => acc + item.stock, 0), icon: HiOutlineCube, color: 'text-indigo-600', bg: 'bg-indigo-50', status: 'All' },
        { label: 'Committed Stock', value: inventory.reduce((acc, item) => acc + (item.committedStock || 0), 0), icon: HiOutlineClipboardDocumentList, color: 'text-amber-600', bg: 'bg-amber-50', status: 'All' },
        { label: 'Low Stock Items', value: inventory.filter(i => i.stock > 0 && i.stock <= i.threshold).length, icon: HiOutlineExclamationTriangle, color: 'text-amber-600', bg: 'bg-amber-50', status: 'Low Stock' },
        { label: 'Out of Stock', value: inventory.filter(i => i.stock === 0).length, icon: HiOutlineArchiveBoxXMark, color: 'text-rose-600', bg: 'bg-rose-50', status: 'Out of Stock' },
        { label: 'Stock Valuation', value: `₹${inventory.reduce((acc, item) => acc + (item.stock * item.price), 0).toLocaleString()}`, icon: HiOutlineArrowsUpDown, color: 'text-emerald-600', bg: 'bg-emerald-50', status: 'In Stock' }
    ], [inventory]);

    const filteredInventory = useMemo(() => {
        const term = debouncedSearchTerm.toLowerCase();
        return inventory.filter(item => {
            const matchesSearch =
                item.name.toLowerCase().includes(term) ||
                (item.sku || '').toString().toLowerCase().includes(term);
            const matchesStatus = filterStatus === 'All' || item.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [inventory, debouncedSearchTerm, filterStatus]);

    const productVariants = useMemo(() => {
        const rows = selectedItem?.variants;
        if (!Array.isArray(rows) || rows.length === 0) return [];
        return rows.map((v, index) => ({
            variantId: v._id ? String(v._id) : String(index),
            index,
            name: v.name || `Variant ${index + 1}`,
            stock: Number(v.stock) || 0,
            unit: v.unit || selectedItem?.unit || '—',
        }));
    }, [selectedItem]);

    const hasVariants = productVariants.length > 0;

    const selectedVariantRow = useMemo(() => {
        if (!hasVariants) return null;
        return (
            productVariants.find((v) => v.variantId === selectedVariantId) ||
            productVariants[0]
        );
    }, [hasVariants, productVariants, selectedVariantId]);

    const displayStock = hasVariants
        ? (selectedVariantRow?.stock ?? 0)
        : (selectedItem?.stock ?? 0);

    const handleFullAdjustment = async () => {
        const value = parseInt(adjustValue, 10);
        if (isNaN(value) || value <= 0) {
            toast.error("Please enter a valid quantity");
            return;
        }

        if (hasVariants && !selectedVariantId) {
            toast.error("Select which variant to update");
            return;
        }

        try {
            const payload = {
                productId: selectedItem.id,
                type: adjustType === 'Restock' ? 'Restock' : 'Correction',
                quantity: value,
                note: adjustNote,
            };
            if (hasVariants) {
                const realId = selectedVariantRow?.variantId;
                if (realId && realId.length === 24) {
                    payload.variantId = realId;
                } else {
                    payload.variantIndex = selectedVariantRow?.index ?? 0;
                }
            }

            const res = await sellerApi.adjustStock(payload);

            if (res.data.success) {
                toast.success(
                    hasVariants
                        ? `Variant stock updated (total: ${res.data.result?.newStock ?? '—'} units)`
                        : "Stock adjusted successfully"
                );
                setIsAdjustModalOpen(false);
                fetchInventory(true);
            }
        } catch (error) {
            const result = error.response?.data?.result;
            if (result?.requiresVariant && Array.isArray(result.variants) && result.variants.length) {
                toast.error(error.response?.data?.message || "Select a variant");
            } else {
                toast.error(error.response?.data?.message || "Failed to adjust stock");
            }
        }
    };

    const openAdjustModal = (item) => {
        setSelectedItem(item);
        setAdjustValue('');
        setAdjustNote('');
        const firstVariant = item?.variants?.[0];
        setSelectedVariantId(
            firstVariant?._id ? String(firstVariant._id) : item?.variants?.length ? '0' : ''
        );
        setIsAdjustModalOpen(true);
    };

    if (isLoading && inventory.length === 0 && history.length === 0) {
        return <div className="flex items-center justify-center min-h-[40vh] font-black text-slate-600">LOADING STOCK DATA...</div>;
    }

    return (
        <div className="space-y-6 pb-16">
            <BlurFade delay={0.1}>
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            Stock Management
                            <Badge variant="warning" className="text-[10px] sm:text-xs px-1.5 py-0 font-bold tracking-wider uppercase bg-amber-100 text-amber-700">
                                Inventory Control
                            </Badge>
                        </h1>
                        <p className="text-slate-600 text-sm mt-0.5 font-medium">
                            Monitor stock levels, manage restocks, and track movements.
                        </p>
                    </div>
                </div>
            </BlurFade>

            {activeView === 'inventory' ? (
                <>
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {stats.map((stat, i) => (
                            <BlurFade key={i} delay={0.1 + (i * 0.05)}>
                                <div onClick={() => setFilterStatus(stat.status)} className="cursor-pointer">
                                    <MagicCard
                                        className="border-none shadow-sm ring-1 ring-slate-100 p-0 overflow-hidden group bg-white"
                                        gradientColor="#f8fafc"
                                    >
                                        <div className="flex items-center gap-3 p-4 relative z-10">
                                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 shadow-sm", stat.bg, stat.color)}>
                                                <stat.icon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest">{stat.label}</p>
                                                <h4 className="text-xl font-black text-slate-900 tracking-tight">{stat.value}</h4>
                                            </div>
                                        </div>
                                    </MagicCard>
                                </div>
                            </BlurFade>
                        ))}
                    </div>

                    <BlurFade delay={0.3}>
                        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden rounded-3xl">
                            {/* Toolbox */}
                            <div className="p-4 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-slate-50/30">
                                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center w-full">
                                    <div className="relative w-full md:w-72">
                                        <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                                        <Input
                                            placeholder="Search by product name or SKU..."
                                            className="pl-10 pr-4 py-2.5 rounded-2xl border-none ring-1 ring-slate-200 bg-white focus:ring-2 focus:ring-primary/20 transition-all text-xs font-semibold"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm">
                                        {['All', 'In Stock', 'Out of Stock'].map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => {
                                                    setFilterStatus(status);
                                                    setPage(1);
                                                }}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all",
                                                    filterStatus === status
                                                        ? "bg-white text-slate-900 shadow-md"
                                                        : "text-slate-600 hover:text-slate-700"
                                                )}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <Button
                                        onClick={() => navigate('/seller/products/add')}
                                        className="rounded-xl px-4 py-2 text-[10px] sm:text-xs font-bold shadow-lg shadow-primary/20 w-full md:w-auto"
                                    >
                                        <HiOutlinePlus className="h-4 w-4 mr-2" />
                                        ADD NEW PRODUCT
                                    </Button>
                                </div>
                            </div>

                            {/* Stock Cards (Mobile View) */}
                            <div className="block md:hidden space-y-4 p-4 bg-slate-50/50">
                                {filteredInventory.length === 0 ? (
                                    <p className="py-8 text-center text-slate-500 font-medium">No inventory items found</p>
                                ) : (
                                    filteredInventory
                                        .slice((page - 1) * pageSize, page * pageSize)
                                        .map((item) => (
                                            <div key={item.id} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col gap-3">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-14 w-14 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center">
                                                        {item.mainImage ? (
                                                            <img src={item.mainImage} alt={item.name} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <HiOutlineCube className="h-6 w-6 text-slate-400" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-base font-bold text-slate-900 truncate">{item.name}</h4>
                                                        <p className="text-xs font-mono text-slate-500 mt-0.5">SKU: {item.sku || 'N/A'}</p>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center border-t border-slate-50 pt-3 mt-1">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-400">Stock Capacity</span>
                                                        <span className={cn("text-base font-black", item.stock <= item.threshold ? "text-rose-600" : "text-slate-900")}>
                                                            {item.stock} units
                                                        </span>
                                                        {item.committedStock > 0 && (
                                                            <span className="text-[10px] font-bold text-amber-600 tracking-wide mt-0.5">
                                                                {item.committedStock} COMMITTED
                                                            </span>
                                                        )}
                                                        {item.stock <= item.threshold && (
                                                            <span className="text-[10px] sm:text-xs font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded w-fit mt-0.5">
                                                                Low Stock
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-xs font-bold text-slate-400">Status</span>
                                                        <Badge
                                                            variant={item.status === 'In Stock' ? 'success' : 'destructive'}
                                                            className="text-[10px] sm:text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg mt-0.5"
                                                        >
                                                            {item.status}
                                                        </Badge>
                                                    </div>
                                                    <button
                                                        onClick={() => openAdjustModal(item)}
                                                        className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black hover:bg-slate-200 transition-colors"
                                                    >
                                                        Adjust
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>

                            {/* Desktop View: Stock Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Product Information</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Inventory Capacity</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Stock Health</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Price</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest text-right whitespace-nowrap">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredInventory.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="px-6 py-10 text-center text-slate-600 text-xs font-black tracking-widest uppercase"
                                                >
                                                    No products found for this filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            <AnimatePresence>
                                                {filteredInventory
                                                    .slice((page - 1) * pageSize, page * pageSize)
                                                    .map((item) => (
                                                        <motion.tr
                                                            key={item.id}
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            className="group hover:bg-slate-50/80 transition-all cursor-default"
                                                        >
                                                            <td className="px-6 py-5">
                                                                <div className="flex items-center gap-4 group">
                                                                    <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 group-hover:scale-105 transition-transform overflow-hidden">
                                                                        {item.mainImage ? (
                                                                            <img src={item.mainImage} alt={item.name} className="h-full w-full object-cover" />
                                                                        ) : (
                                                                            <HiOutlineCube className="h-6 w-6" />
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">
                                                                            {item.name}
                                                                        </h4>
                                                                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                                                                            Product Code: {item.sku || 'N/A'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex flex-col">
                                                                        <span
                                                                            className={cn(
                                                                                "text-sm font-black",
                                                                                item.stock <= item.threshold ? "text-rose-600" : "text-slate-900"
                                                                            )}
                                                                        >
                                                                            {item.stock} units
                                                                        </span>
                                                                        {item.committedStock > 0 && (
                                                                            <span className="text-[10px] font-bold text-amber-600 tracking-wide mt-0.5">
                                                                                {item.committedStock} COMMITTED
                                                                            </span>
                                                                        )}
                                                                        {item.stock <= item.threshold && (
                                                                            <span className="text-[10px] sm:text-xs font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded w-fit mt-0.5">
                                                                                Low Stock
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <Badge
                                                                    variant={item.status === 'In Stock' ? 'success' : 'destructive'}
                                                                    className="text-[10px] sm:text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg"
                                                                >
                                                                    {item.status}
                                                                </Badge>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <p className="text-sm font-black text-slate-900">₹{item.price}</p>
                                                            </td>
                                                            <td className="px-6 py-5 text-right">
                                                                <button
                                                                    onClick={() => openAdjustModal(item)}
                                                                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors"
                                                                >
                                                                    Adjust Stock
                                                                </button>
                                                            </td>
                                                        </motion.tr>
                                                    ))}
                                            </AnimatePresence>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </BlurFade>

                    <div className="mt-4">
                        <Pagination
                            page={page}
                            totalPages={Math.ceil(filteredInventory.length / pageSize) || 1}
                            total={filteredInventory.length}
                            pageSize={pageSize}
                            onPageChange={(p) => setPage(p)}
                            onPageSizeChange={(newSize) => {
                                setPageSize(newSize);
                                setPage(1);
                            }}
                            loading={isLoading}
                        />
                    </div>
                </>
            ) : (
                /* History View */
                <BlurFade delay={0.2}>
                    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl p-0 overflow-hidden">
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                            <div>
                                <h3 className="text-base font-black text-slate-900">Inventory Movement Log</h3>
                                <p className="text-sm text-slate-600 font-medium">Audit trail for all stock adjustments and sales.</p>
                            </div>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {history.length === 0 ? (
                                <div className="p-10 text-center text-slate-600 font-black uppercase tracking-widest">No history found</div>
                            ) : history.map((log) => (
                                <div key={log._id} className="p-6 hover:bg-slate-50/50 transition-colors flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between group">
                                    <div className="flex items-center gap-5 min-w-0">
                                        <div className={cn(
                                            "h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center shadow-sm",
                                            log.type === 'Restock' ? "bg-emerald-50 text-emerald-600" :
                                                log.type === 'Sale' ? "bg-indigo-50 text-indigo-600" : "bg-rose-50 text-rose-600"
                                        )}>
                                            {log.type === 'Restock' ? <HiOutlinePlus className="h-6 w-6" /> :
                                                log.type === 'Sale' ? <HiOutlineCube className="h-6 w-6" /> : <HiOutlineMinus className="h-6 w-6" />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <h4 className="text-sm font-black text-slate-900 min-w-0 truncate">{log.product?.name || 'Unknown Product'}</h4>
                                                <Badge className={cn(
                                                    "text-[10px] sm:text-xs font-bold px-1.5 py-0 shrink-0",
                                                    log.type === 'Restock' ? "bg-emerald-100 text-emerald-700" :
                                                        log.type === 'Sale' ? "bg-indigo-100 text-indigo-700" : "bg-rose-100 text-rose-700"
                                                )}>
                                                    {log.type.toUpperCase()}
                                                </Badge>
                                            </div>
                                            <p className="text-[11px] text-slate-600 font-semibold mt-1 truncate">Note: {log.note || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right shrink-0">
                                        <div className={cn(
                                            "text-lg font-black tracking-tight mb-0.5",
                                            log.quantity > 0 ? "text-emerald-600" : "text-rose-600"
                                        )}>
                                            {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                                        </div>
                                        <div className="flex items-center sm:justify-end gap-1.5 text-[10px] font-bold text-slate-600">
                                            <HiOutlineCalendarDays className="h-3.5 w-3.5" />
                                            {new Date(log.createdAt).toLocaleDateString()} • {new Date(log.createdAt).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </BlurFade>
            )}

            {/* Advanced Adjustment Modal */}
            <AnimatePresence>
                {isAdjustModalOpen && selectedItem && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setIsAdjustModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="w-full max-w-md relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-900/20">
                                        <HiOutlineArrowsUpDown className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900">Adjust Inventory</h3>
                                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none mt-1">Update product stock</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAdjustModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
                                    <HiOutlineXMark className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 overflow-hidden">
                                        {selectedItem.mainImage ? (
                                            <img src={selectedItem.mainImage} alt="" className="h-full w-full object-cover" />
                                        ) : <HiOutlineCube className="h-6 w-6" />}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900">{selectedItem.name}</h4>
                                        <p className="text-[10px] font-bold text-slate-600">
                                            {hasVariants ? 'VARIANT STOCK' : 'CURRENT STOCK'}:{' '}
                                            <span className="text-slate-900 font-black">{displayStock} UNITS</span>
                                            {hasVariants && (
                                                <span className="text-slate-500 font-semibold normal-case">
                                                    {' '}(total {selectedItem.stock} across {productVariants.length} variants)
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {hasVariants && (
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">
                                                Which variant?
                                            </label>
                                            <select
                                                value={selectedVariantId}
                                                onChange={(e) => setSelectedVariantId(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 outline-none"
                                            >
                                                {productVariants.map((v) => (
                                                    <option key={v.variantId} value={v.variantId}>
                                                        {v.name} — {v.stock} {v.unit} in stock
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                        {['Restock', 'Remove'].map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setAdjustType(type)}
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                                    adjustType === type
                                                        ? "bg-white text-slate-900 shadow-md"
                                                        : "text-slate-600 hover:text-slate-600"
                                                )}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Quantity Change</label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-600">#</div>
                                            <input
                                                type="number"
                                                value={adjustValue}
                                                onChange={(e) => setAdjustValue(e.target.value)}
                                                className="w-full pl-10 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-2xl font-black text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Internal Note (Optional)</label>
                                        <textarea
                                            value={adjustNote}
                                            onChange={(e) => setAdjustNote(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none h-20"
                                            placeholder="Reason for adjustment..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                                <Button
                                    onClick={() => setIsAdjustModalOpen(false)}
                                    variant="outline"
                                    className="flex-1 py-4 text-xs font-bold rounded-2xl bg-white"
                                >
                                    CANCEL
                                </Button>
                                <Button
                                    onClick={handleFullAdjustment}
                                    className="flex-1 py-4 text-xs font-bold rounded-2xl shadow-xl shadow-primary/20"
                                >
                                    SAVE CHANGES
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StockManagement;
