import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    HiOutlinePlus,
    HiOutlineBuildingOffice2,
    HiOutlineMagnifyingGlass,
    HiOutlineFunnel,
    HiOutlineTrash,
    HiOutlinePencilSquare,
    HiOutlineEye,
    HiOutlineStar,
    HiOutlineEnvelope,
    HiOutlinePhone,
    HiOutlineCalendarDays,
    HiOutlineArrowTrendingUp,
    HiOutlineMapPin,
    HiOutlineCheckCircle,
    HiOutlineXMark,
    HiOutlineChevronRight,
    HiOutlineEllipsisHorizontal,
    HiOutlineArchiveBox,
    HiOutlineChevronDown
} from 'react-icons/hi2';
import SellerProductsExpandPanel from '../components/SellerProductsExpandPanel';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../services/adminApi';
import SellerTabs from '../components/SellerTabs';
import { SupplyFormModal, SupplyInfoModal } from '../components/supply/SupplyActionModals';

const ActiveSellers = () => {
    const navigate = useNavigate();
    const [sellers, setSellers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchSellers = async () => {
        try {
            setIsLoading(true);
            const res = await adminApi.getSellers();
            console.log("Verified Sellers API Response:", res.data);

            // Maximum robustness in data extraction
            const rawData = res.data;
            let items = [];

            if (rawData?.result?.items && Array.isArray(rawData.result.items)) {
                items = rawData.result.items;
            } else if (rawData?.result && Array.isArray(rawData.result)) {
                items = rawData.result;
            } else if (rawData?.results && Array.isArray(rawData.results)) {
                items = rawData.results;
            } else if (rawData?.data?.items && Array.isArray(rawData.data.items)) {
                items = rawData.data.items;
            } else if (rawData?.data && Array.isArray(rawData.data)) {
                items = rawData.data;
            } else if (Array.isArray(rawData)) {
                items = rawData;
            }

            console.table(items); // Helpful for debugging in browser console
            setSellers(items);
        } catch (error) {
            console.error('Fetch sellers failed:', error);
            setSellers([]);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchSellers();
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await adminApi.getProducts({ page: 1, limit: 300, status: "active" });
            const payload = res?.data?.result || {};
            setProducts(Array.isArray(payload.items) ? payload.items : []);
        } catch {
            setProducts([]);
        }
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
    const [viewingSeller, setViewingSeller] = useState(null);
    const [editingSeller, setEditingSeller] = useState(null);
    const [addingSeller, setAddingSeller] = useState(false);
    const [requestOpen, setRequestOpen] = useState(false);
    const [requestForm, setRequestForm] = useState({ productId: "", quantity: "100" });
    const [infoOpen, setInfoOpen] = useState(false);
    const [infoMessage, setInfoMessage] = useState("");
    const [products, setProducts] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState({
        minRevenue: 0,
        minRating: 0
    });
    const [expandedSellerId, setExpandedSellerId] = useState(null);

    const toggleSellerProducts = (sellerId) => {
        setExpandedSellerId((prev) => (prev === sellerId ? null : sellerId));
    };

    const [formState, setFormState] = useState({
        shopName: '',
        name: '',
        email: '',
        phone: '',
        password: '',
        category: 'Grocery',
        location: '',
        serviceRadius: 5
    });

    const stats = useMemo(() => {
        const verifiedCount = sellers.length;
        const totalRevenue = sellers.reduce((acc, s) => acc + (Number(s.totalRevenue) || 0), 0);
        return {
            total: verifiedCount,
            topRated: sellers.filter(s => (Number(s.rating) || 0) >= 4.5).length,
            highVolume: sellers.filter(s => (Number(s.totalOrders) || 0) > 50).length,
            totalRevenue: totalRevenue
        };
    }, [sellers]);

    const filteredSellers = useMemo(() => {
        return sellers.filter(s => {
            const shop = (s.shopName || '').toLowerCase();
            const owner = (s.name || '').toLowerCase();
            const mail = (s.email || '').toLowerCase();
            const term = searchTerm.toLowerCase();

            const matchesSearch = shop.includes(term) || owner.includes(term) || mail.includes(term);
            const matchesCategory = filterCategory === 'all' || s.category === filterCategory;
            
            // Default to 0 if fields are missing
            const revenue = Number(s.totalRevenue) || Number(s.revenue) || 0;
            const rating = Number(s.rating) || 0;

            const matchesRevenue = revenue >= (Number(advancedFilters.minRevenue) || 0);
            const matchesRating = rating >= (Number(advancedFilters.minRating) || 0);
            
            return matchesSearch && matchesCategory && matchesRevenue && matchesRating;
        });
    }, [sellers, searchTerm, filterCategory, advancedFilters]);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formState };
            if (formState.location) {
                const coords = formState.location.split(',').map(s => s.trim());
                if (coords.length === 2) {
                    payload.lng = Number(coords[0]);
                    payload.lat = Number(coords[1]);
                }
            }
            if (addingSeller) {
                payload.radius = Math.max(1, Number(formState.serviceRadius || 5));
                payload.isActive = true;
                payload.isVerified = true;
                await adminApi.createSeller(payload);
                setAddingSeller(false);
            } else {
                await adminApi.updateSeller(editingSeller._id, payload);
                setEditingSeller(null);
            }
            fetchSellers();
            setInfoMessage(addingSeller ? "Seller created successfully" : "Seller updated successfully");
            setInfoOpen(true);
        } catch (error) {
            setInfoMessage(error?.response?.data?.message || 'Action failed');
            setInfoOpen(true);
        }
    };

    const createPurchaseRequest = async () => {
        if (!viewingSeller) return;
        const productId = String(requestForm.productId || "").trim();
        if (!productId) {
            setInfoMessage("Please select a product.");
            setInfoOpen(true);
            return;
        }
        const qty = Math.max(1, Number(requestForm.quantity || 1));
        try {
            await adminApi.createManualPurchaseRequest({
                vendorId: viewingSeller._id,
                productId,
                quantity: qty,
            });
            setRequestOpen(false);
            setInfoMessage("Purchase request created.");
            setInfoOpen(true);
        } catch (error) {
            setInfoMessage(error?.response?.data?.message || "Failed to create purchase request.");
            setInfoOpen(true);
        }
    };

    const deleteSeller = (id) => {
        if (window.confirm('Are you sure you want to remove this seller?')) {
            setSellers(sellers.filter(s => s.id !== id));
            setIsSellerModalOpen(false);
        }
    };

    const openSellerDetails = (seller) => {
        setViewingSeller(seller);
        setIsSellerModalOpen(true);
    };

    const toggleSellerStatus = async (sellerId, currentStatus) => {
        try {
            const newStatus = !currentStatus;
            await adminApi.updateSeller(sellerId, { isActive: newStatus, isVerified: newStatus });
            fetchSellers();
        } catch (error) {
            console.error("Failed to update status", error);
            alert("Failed to update seller status.");
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
            <SellerTabs />
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1 flex items-center gap-2">
                        Sellers
                    </h1>
                    <p className="ds-description mt-0.5">View and manage all sellers.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setFormState({ shopName: '', name: '', email: '', phone: '', password: '', category: 'Grocery', location: '', serviceRadius: 5 });
                            setAddingSeller(true);
                        }}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold transition hover:bg-slate-800"
                    >
                        Add Seller
                    </button>
                    <button onClick={fetchSellers} className="px-4 py-2 bg-white ring-1 ring-slate-200 text-slate-700 rounded-xl text-xs font-bold transition hover:bg-slate-50">
                        Refresh
                    </button>
                </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Verified Partners', val: stats.total, icon: HiOutlineBuildingOffice2, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Elite Sellers', val: stats.topRated, icon: HiOutlineStar, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Peak Performance', val: stats.highVolume, icon: HiOutlineArrowTrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Gross Revenue', val: `₹${(stats.totalRevenue / 100000).toFixed(1)}L`, icon: HiOutlineCheckCircle, color: 'text-indigo-600', bg: 'bg-indigo-50' }
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100 p-4 group">
                        <div className="flex items-center gap-3">
                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", stat.bg, stat.color)}>
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
            <Card className="border-none shadow-sm ring-1 ring-slate-100 p-3 bg-white/60 backdrop-blur-xl">
                <div className="flex flex-col lg:flex-row gap-3 items-center">
                    <div className="relative flex-1 group w-full">
                        <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-all" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by shop name, owner or email..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
                        />
                    </div>
                    <div className="flex gap-2 shrink-0 w-full lg:w-auto">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                            <option value="all">All Specialties</option>
                            <option value="Grocery">Grocery</option>
                            <option value="Electronics">Electronics</option>
                            <option value="Dairy">Dairy</option>
                        </select>
                        <div className="relative">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn(
                                    "flex items-center space-x-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold transition-all",
                                    showFilters ? "bg-slate-900 text-white ring-slate-900" : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <HiOutlineFunnel className="h-4 w-4" />
                                <span>Filters</span>
                            </button>

                            {showFilters && (
                                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Advanced Intel</h4>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-600">Min Revenue (₹)</label>
                                            <input
                                                type="number"
                                                value={advancedFilters.minRevenue}
                                                onChange={(e) => setAdvancedFilters({ ...advancedFilters, minRevenue: e.target.value })}
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
                                                onChange={(e) => setAdvancedFilters({ ...advancedFilters, minRating: e.target.value })}
                                                className="w-full accent-primary"
                                            />
                                            <div className="flex justify-between text-[8px] font-bold text-slate-400">
                                                <span>0</span>
                                                <span>{advancedFilters.minRating}</span>
                                                <span>5</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setAdvancedFilters({ minRevenue: 0, minRating: 0 });
                                                setFilterCategory('all');
                                                setSearchTerm('');
                                            }}
                                            className="w-full py-2 text-[10px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
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

            {/* Sellers Grid/Table */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="ds-table-header-cell px-6">Store Entity</th>
                                <th className="ds-table-header-cell px-6">Products</th>
                                <th className="ds-table-header-cell px-6">Performance</th>
                                <th className="ds-table-header-cell px-6 text-center">Business Intel</th>
                                <th className="ds-table-header-cell px-6">Status</th>
                                <th className="ds-table-header-cell px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-12 w-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-4" />
                                            <p className="text-slate-500 font-bold text-sm">Fetching sellers...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSellers.length > 0 ? filteredSellers.map((s) => {
                                const isExpanded = expandedSellerId === s._id;
                                return (
                                <React.Fragment key={s._id}>
                                <tr
                                    className={cn(
                                        "transition-colors group cursor-pointer",
                                        isExpanded ? "bg-violet-50/40" : "hover:bg-slate-50/30",
                                    )}
                                    onClick={() => toggleSellerProducts(s._id)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3 group/name">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSellerProducts(s._id);
                                                }}
                                                className={cn(
                                                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                                    isExpanded ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500",
                                                )}
                                            >
                                                <HiOutlineChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                            </button>
                                            <div className="h-12 w-12 rounded-2xl overflow-hidden bg-slate-100 ring-2 ring-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                                                <HiOutlineBuildingOffice2 className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{s.shopName}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-semibold text-slate-400">{s.name}</span>
                                                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                    <span className="text-[10px] font-bold text-primary">{s.category || 'N/A'}</span>
                                                </div>
                                                <p className="text-[9px] font-bold text-violet-600 mt-0.5">
                                                    Tap row to {isExpanded ? 'hide' : 'view'} products
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-900">
                                                {s.productCount ?? s.productStats?.totalProducts ?? 0} products
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                {(s.productStats?.inStockProducts ?? 0)} in stock
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex items-center text-amber-500">
                                                    <HiOutlineStar className="h-3 w-3 fill-current" />
                                                    <span className="text-xs font-bold ml-1">{s.rating || '0.0'}</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-300">/ 5.0</span>
                                            </div>
                                            <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-amber-400 rounded-full"
                                                    style={{ width: `${((s.rating || 0) / 5) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-bold text-slate-900">{(s.totalOrders || 0).toLocaleString()} Orders</span>
                                            <span className="text-[9px] font-bold text-emerald-600 mt-0.5">₹{((s.revenue || 0) / 1000).toFixed(1)}k Revenue</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSellerStatus(s._id, s.isActive);
                                                }}
                                                className={cn(
                                                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 shadow-inner",
                                                    s.isActive ? "bg-emerald-500" : "bg-slate-300"
                                                )}
                                            >
                                                <span 
                                                    className={cn(
                                                        "inline-flex items-center justify-center h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                                                        s.isActive ? "translate-x-4" : "translate-x-1"
                                                    )} 
                                                >
                                                  {s.isActive && <Check className="text-emerald-500 h-2.5 w-2.5" />}
                                                </span>
                                            </button>
                                            <span className={cn(
                                                "text-[10px] font-bold tracking-wider uppercase",
                                                s.isActive ? "text-emerald-600" : "text-slate-500"
                                            )}>
                                                {s.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end space-x-2">
                                            <button
                                                onClick={() => { setViewingSeller(s); setRequestOpen(true); }}
                                                className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-emerald-500"
                                                title="Send Purchase Request"
                                            >
                                                <HiOutlineArchiveBox className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => openSellerDetails(s)}
                                                className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-primary"
                                                title="View Details"
                                            >
                                                <HiOutlineEye className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr>
                                        <td colSpan={6} className="p-0">
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
                            }) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center text-slate-400 font-bold">NO SELLERS FOUND</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Seller Detail Drawer/Modal */}
            <AnimatePresence>
                {isSellerModalOpen && viewingSeller && (
                    <div className="fixed inset-0 z-[100] overflow-y-auto">
                        <div className="min-h-full flex items-center justify-center p-4 lg:p-5">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                                onClick={() => setIsSellerModalOpen(false)}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="w-full max-w-2xl relative z-10 bg-white rounded-xl overflow-hidden shadow-2xl my-auto"
                            >
                                <div className="relative h-32 bg-slate-900">
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent" />
                                    <button
                                        onClick={() => setIsSellerModalOpen(false)}
                                        className="absolute right-6 top-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                                    >
                                        <HiOutlineXMark className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="px-4 pb-8">
                                    <div className="relative -mt-12 flex items-end justify-between mb-8">
                                        <div className="h-24 w-24 rounded-xl border-4 border-white overflow-hidden bg-slate-100 shadow-xl flex items-center justify-center text-slate-300">
                                            <HiOutlineBuildingOffice2 className="h-10 w-10" />
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => {
                                                    setEditingSeller(viewingSeller);
                                                    setFormState({
                                                        shopName: viewingSeller.shopName,
                                                        name: viewingSeller.name,
                                                        email: viewingSeller.email,
                                                        phone: viewingSeller.phone,
                                                        category: viewingSeller.category || 'Grocery',
                                                        location: viewingSeller.location?.coordinates?.join(', ') || '',
                                                        serviceRadius: viewingSeller.serviceRadius
                                                    });
                                                    setIsSellerModalOpen(false);
                                                }}
                                                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg transition-all hover:-translate-y-0.5"
                                            >
                                                EDIT
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-6">
                                            <div>
                                                <h2 className="ds-h1">{viewingSeller.shopName}</h2>
                                                <p className="ds-description mt-0.5">{viewingSeller.category || 'Business'} Partner</p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3 text-slate-600">
                                                    <HiOutlineBuildingOffice2 className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-bold">{viewingSeller.name} (Owner)</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-slate-600">
                                                    <HiOutlineEnvelope className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-semibold">{viewingSeller.email}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-slate-600">
                                                    <HiOutlinePhone className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-bold">{viewingSeller.phone}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 rounded-xl p-6 space-y-6">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Business Snapshot</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-white rounded-2xl border border-slate-100">
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Sales</p>
                                                    <p className="text-lg font-bold text-slate-900">₹{((viewingSeller.revenue || 0) / 1000).toFixed(1)}k</p>
                                                </div>
                                                <div className="p-4 bg-white rounded-2xl border border-slate-100">
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Orders</p>
                                                    <p className="text-lg font-bold text-slate-900">{viewingSeller.totalOrders || 0}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
            {/* Edit/Add Modal */}
            <AnimatePresence>
                {(editingSeller || addingSeller) && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                            onClick={() => { setEditingSeller(null); setAddingSeller(false); }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-lg relative z-[120] bg-white rounded-xl p-4 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">{addingSeller ? 'Add New Seller' : 'Edit Shop Profile'}</h3>
                                    <p className="text-xs text-slate-500 font-medium">Configure store settings and identity.</p>
                                </div>
                                <button onClick={() => { setEditingSeller(null); setAddingSeller(false); }} className="p-2 hover:bg-slate-100 rounded-full">
                                    <HiOutlineXMark className="h-5 w-5 text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleFormSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Shop Name</label>
                                        <input
                                            required
                                            value={formState.shopName}
                                            onChange={(e) => setFormState({ ...formState, shopName: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none ring-1 ring-slate-100 focus:ring-primary/20 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Specialty</label>
                                        <select
                                            value={formState.category}
                                            onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                                        >
                                            <option>Grocery</option>
                                            <option>Electronics</option>
                                            <option>Dairy</option>
                                            <option>Fruits & Veggies</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Owner Name</label>
                                    <input
                                        required
                                        value={formState.name}
                                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none ring-1 ring-slate-100 focus:ring-primary/20 transition-all"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                        <input
                                            type="email"
                                            required
                                            value={formState.email}
                                            onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                                        <input
                                            required
                                            value={formState.phone}
                                            onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                                        />
                                    </div>
                                </div>
                                
                                {addingSeller && (
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                        <input
                                            required
                                            value={formState.password}
                                            onChange={(e) => setFormState({ ...formState, password: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                                            placeholder="Enter initial password"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-4 gap-4 items-end">
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Coordinates (Lng, Lat)</label>
                                        <input
                                            placeholder="e.g. 77.123, 28.123"
                                            value={formState.location}
                                            onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Range (km)</label>
                                        <input
                                            type="number"
                                            value={formState.serviceRadius}
                                            onChange={(e) => setFormState({ ...formState, serviceRadius: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-bold shadow-xl hover:bg-slate-800 transition-all transform active:scale-[0.98] mt-4">
                                    {addingSeller ? 'ADD SELLER' : 'UPDATE SHOP PROFILE'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Purchase Request Modal */}
            <SupplyFormModal
                isOpen={requestOpen}
                onClose={() => setRequestOpen(false)}
                title={`Send Purchase Request${viewingSeller ? ` - ${viewingSeller.shopName}` : ""}`}
                submitLabel="Create"
                fields={[
                    {
                        key: "productId",
                        label: "Product",
                        type: "select",
                        options: [
                            { value: "", label: "Select Product" },
                            ...products.map((p) => ({
                                value: p._id,
                                label: p.name,
                            })),
                        ],
                    },
                    { key: "quantity", label: "Quantity", type: "number" },
                ]}
                values={requestForm}
                onChange={(key, value) => setRequestForm((prev) => ({ ...prev, [key]: value }))}
                onSubmit={createPurchaseRequest}
            />

            <SupplyInfoModal
                isOpen={infoOpen}
                onClose={() => setInfoOpen(false)}
                title="Sellers Update"
                message={infoMessage}
            />
        </div>
    );
};

export default ActiveSellers;
