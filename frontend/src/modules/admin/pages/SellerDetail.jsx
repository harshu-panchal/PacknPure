import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    ChevronLeft,
    Building2,
    User,
    Mail,
    Phone,
    MapPin,
    Star,
    Calendar,
    Wallet,
    TrendingUp,
    ShoppingBag,
    History,
    Banknote,
    Clock,
    ArrowUpRight,
    Edit3,
    MoreVertical,
    CheckCircle2,
    XCircle,
    RotateCw,
    Search,
    Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import Modal from '@shared/components/ui/Modal';
import { motion } from 'framer-motion';
import { adminApi } from '../services/adminApi';

function formatLocation(data) {
    if (typeof data?.address === 'string' && data.address.trim()) return data.address.trim();
    if (data?.locationText) return data.locationText;
    const coords = data?.location?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
        return `${Number(coords[1]).toFixed(4)}, ${Number(coords[0]).toFixed(4)}`;
    }
    return 'Not mapped';
}

function formatCoords(data) {
    const coords = data?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return `${Number(coords[1]).toFixed(4)}, ${Number(coords[0]).toFixed(4)}`;
}

function money(n) {
    return `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
}

function sellerStatusMeta(data) {
    if (!data?.isVerified) return { label: 'pending', variant: 'warning' };
    if (data?.isActive === false) return { label: 'inactive', variant: 'gray' };
    return { label: 'active', variant: 'success' };
}

function hasBankDetails(bank) {
    if (!bank || typeof bank !== 'object') return false;
    const name = String(bank.bankName || '').trim();
    const acct = String(bank.accountNo || '').trim();
    return Boolean(name && name !== 'Not Provided' && acct && acct !== 'N/A');
}

const SellerDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('products');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [seller, setSeller] = useState(null);

    const fetchSellerData = async () => {
        try {
            setIsLoading(true);
            const res = await adminApi.getSellerById(id);
            const body = res?.data || {};
            const data = body.result ?? body.data ?? (body.success === false ? null : body);
            if (body.success === false || !data || typeof data !== 'object') {
                throw new Error(body.message || 'Seller not found');
            }
            if (data) {
                setSeller({
                    ...data,
                    id: data._id || data.id,
                    ownerName: data.name || '—',
                    category: data.category || 'General',
                    status: sellerStatusMeta(data).label,
                    statusVariant: sellerStatusMeta(data).variant,
                    isVerified: !!data.isVerified,
                    isActive: data.isActive !== false,
                    description: data.description || '',
                    documents: data.documents || null,
                    coordsLabel: formatCoords(data),
                    joinedDate: data.createdAt
                        ? new Date(data.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—',
                    totalOrders: Number(data.stats?.totalOrders) || 0,
                    totalRevenue: Number(data.stats?.totalRevenue) || 0,
                    recentOrders: Array.isArray(data.stats?.recentOrders) ? data.stats.recentOrders : [],
                    products: Array.isArray(data.products) ? data.products : [],
                    productStats: data.productStats || data.stats?.productStats || {
                        totalProducts: Number(data.productCount) || 0,
                        activeProducts: 0,
                        pendingProducts: 0,
                        inStockProducts: 0,
                        totalStock: 0,
                    },
                    productCount: Number(data.productCount) || Number(data.productStats?.totalProducts) || 0,
                    walletBalance: Number(data.walletBalance) || 0,
                    rating: Number(data.rating) || 0,
                    serviceRadius: Number(data.serviceRadius) || 5,
                    commissionRate: data.commissionRate ?? 'N/A',
                    locationLabel: formatLocation(data),
                    bankInfo: data.bankDetails || {
                        bankName: 'Not Provided',
                        accountNo: 'N/A',
                        ifsc: 'N/A',
                    },
                });
            }
        } catch (error) {
            console.error('Fetch seller detail failed:', error);
            showToast('Failed to load seller details', 'error');
            navigate('/admin/suppliers');
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchSellerData();
    }, [id]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchSellerData();
        setIsRefreshing(false);
        showToast('Seller data synchronized', 'success');
    };

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading store data...</p>
                </div>
            </div>
        );
    }

    if (!seller) return null;

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header / Action Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin/suppliers')}
                        className="p-2.5 bg-white ring-1 ring-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm group"
                    >
                        <ChevronLeft className="h-5 w-5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="ds-h1">{seller.shopName}</h1>
                            <Badge variant={seller.statusVariant || 'gray'} className="text-[10px] font-black uppercase tracking-widest">{seller.status}</Badge>
                        </div>
                        <p className="ds-description mt-1 text-slate-500 font-medium">Owned by {seller.ownerName} • {seller.category}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all"
                    >
                        <RotateCw className={cn("h-4 w-4 text-primary", isRefreshing && "animate-spin")} />
                        SYNC DATA
                    </button>
                    <button className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                        <Edit3 className="h-4 w-4" />
                        EDIT SHOP
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Product Listings', value: seller.productCount ?? 0, icon: ShoppingBag, color: 'indigo', sub: `${seller.productStats?.activeProducts ?? 0} active · ${seller.productStats?.pendingProducts ?? 0} pending` },
                    { label: 'Supply Stock', value: seller.productStats?.totalStock ?? 0, icon: TrendingUp, color: 'blue', sub: 'Total units (S)' },
                    { label: 'Orders Handled', value: seller.totalOrders, icon: History, color: 'emerald', sub: 'Lifetime Orders' },
                    { label: 'Total Revenue', value: seller.totalRevenue >= 1000 ? `₹${(seller.totalRevenue / 1000).toFixed(1)}k` : money(seller.totalRevenue), icon: Wallet, color: 'amber', sub: 'Delivered orders' },
                ].map((stat, i) => (
                    <Card key={i} className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-2.5 rounded-2xl",
                                stat.color === 'emerald' && "bg-emerald-50 text-emerald-600",
                                stat.color === 'blue' && "bg-blue-50 text-blue-600",
                                stat.color === 'indigo' && "bg-indigo-50 text-indigo-600",
                                stat.color === 'amber' && "bg-amber-50 text-amber-600",
                            )}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.sub}</span>
                        </div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</h4>
                        <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Tabs Navigation */}
                    <div className="flex items-center gap-2 p-1 bg-slate-100/50 backdrop-blur-sm rounded-2xl w-fit">
                        {[
                            { id: 'products', label: 'Products', icon: ShoppingBag },
                            { id: 'orders', label: 'Order History', icon: History },
                            { id: 'delivery', label: 'Coverage', icon: MapPin },
                            { id: 'info', label: 'Store Info', icon: Building2 },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                    activeTab === tab.id
                                        ? "bg-white text-primary shadow-sm ring-1 ring-slate-200"
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden min-h-[500px]">
                        {activeTab === 'products' && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="p-4 pb-4 flex items-center justify-between border-b border-slate-50">
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                                        Supplier product listings
                                    </h4>
                                    <Badge variant="primary" className="text-[9px] font-black">
                                        {seller.productCount ?? seller.products?.length ?? 0} items
                                    </Badge>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-50">
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stock (S)</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Supply cost</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Master catalog</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {(seller.products || []).length > 0 ? seller.products.map((product) => (
                                                <tr key={product._id} className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-4">
                                                        <span className="text-xs font-black text-slate-900">{product.name}</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center font-black text-violet-700">
                                                        {Number(product.stock) || 0}
                                                    </td>
                                                    <td className="px-4 py-4 text-center font-bold text-slate-800">
                                                        {money(product.purchasePrice)}
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <Badge
                                                            variant={product.status === 'active' ? 'success' : product.status === 'pending_approval' ? 'warning' : 'gray'}
                                                            className="text-[9px] font-black"
                                                        >
                                                            {(product.status || '—').replace(/_/g, ' ').toUpperCase()}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-4 text-xs text-slate-600">
                                                        {product.masterProductName || (
                                                            <span className="text-slate-400 italic">Not mapped</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-10 text-center text-slate-400 font-bold text-xs">
                                                        No products listed by this supplier yet.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'orders' && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="p-4 pb-4 flex items-center justify-between border-b border-slate-50">
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Recent Orders</h4>
                                    <div className="flex items-center gap-4">
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Order ID..."
                                                className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold w-40 outline-none ring-1 ring-transparent focus:ring-primary/20"
                                            />
                                        </div>
                                        <button className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-primary transition-colors">
                                            <Download className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-50">
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order ID</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {seller.recentOrders.length > 0 ? seller.recentOrders.map((order, i) => (
                                                <tr key={i} className="group hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/orders/view/${order.id}`)}>
                                                    <td className="px-4 py-5">
                                                        <span className="text-xs font-black text-slate-900">{order.id}</span>
                                                        <p className="text-[10px] font-bold text-slate-400">{new Date(order.date).toLocaleDateString()}</p>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        <span className="text-xs font-bold text-slate-700">{order.customer}</span>
                                                    </td>
                                                    <td className="px-4 py-5 text-center">
                                                        <Badge
                                                            variant={order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'error' : 'warning'}
                                                            className="text-[9px] font-black"
                                                        >
                                                            {String(order.status || 'pending').toUpperCase()}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-5 text-right font-black text-slate-900">
                                                        {money(order.amount)}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="4" className="px-4 py-10 text-center text-slate-400 font-bold text-xs">No orders found for this seller yet.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'delivery' && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300 h-[500px] relative overflow-hidden group">
                                {/* Map Background Overlay */}
                                <div className="absolute inset-0 grayscale-[0.3] contrast-[1.1] opacity-40 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=2000')]" />
                                <div className="absolute inset-0 bg-gradient-to-tr from-slate-200/50 via-transparent to-primary/5" />

                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="relative">
                                        {/* Service Area Radar */}
                                        <motion.div
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ duration: 1, ease: "easeOut" }}
                                            className="rounded-full bg-primary/20 border-2 border-primary/40 shadow-[0_0_50px_rgba(var(--primary),0.3)] animate-pulse"
                                            style={{
                                                width: `${seller.serviceRadius * 40}px`,
                                                height: `${seller.serviceRadius * 40}px`
                                            }}
                                        />
                                        {/* Store Marker */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                            <div className="h-10 w-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-white z-10 relative">
                                                <Building2 className="h-5 w-5" />
                                            </div>
                                            <div className="absolute inset-0 bg-primary rounded-2xl animate-ping opacity-20" />
                                        </div>
                                    </div>
                                </div>

                                {/* Floating Legend */}
                                <div className="absolute top-6 left-6 flex flex-col gap-2">
                                    <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-white/50">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coverage View</p>
                                        <h5 className="text-sm font-black text-slate-900">{seller.serviceRadius} km radius</h5>
                                        {seller.coordsLabel ? (
                                            <p className="text-[10px] text-slate-500 mt-1">GPS: {seller.coordsLabel}</p>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="absolute bottom-6 right-6 p-4 max-w-[240px] bg-slate-900/90 backdrop-blur rounded-2xl text-white shadow-2xl border border-white/10">
                                    <p className="text-[9px] font-black opacity-60 uppercase mb-1">Service address</p>
                                    <p className="text-[10px] font-bold leading-relaxed">{seller.locationLabel}</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'info' && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                                    <div className="ds-section-spacing">
                                        <div>
                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Store Identity</h5>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                                                        <Building2 className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-900">{seller.shopName}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{seller.id}</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
                                                        <p className="text-xs font-black text-slate-900">{seller.category}</p>
                                                    </div>
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Joined</p>
                                                        <p className="text-xs font-black text-slate-900">{seller.joinedDate}</p>
                                                    </div>
                                                </div>
                                                {seller.description ? (
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</p>
                                                        <p className="text-xs font-semibold text-slate-700">{seller.description}</p>
                                                    </div>
                                                ) : null}
                                                {seller.documents ? (
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Documents</p>
                                                        {seller.documents.tradeLicense ? (
                                                            <a href={seller.documents.tradeLicense} target="_blank" rel="noreferrer" className="block text-xs font-bold text-primary hover:underline">Trade license</a>
                                                        ) : null}
                                                        {seller.documents.gstCertificate ? (
                                                            <a href={seller.documents.gstCertificate} target="_blank" rel="noreferrer" className="block text-xs font-bold text-primary hover:underline">GST certificate</a>
                                                        ) : null}
                                                        {seller.documents.idProof ? (
                                                            <a href={seller.documents.idProof} target="_blank" rel="noreferrer" className="block text-xs font-bold text-primary hover:underline">ID proof</a>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div>
                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Bank / settlement</h5>
                                            <div className={cn(
                                                'p-6 rounded-xl border space-y-4',
                                                hasBankDetails(seller.bankInfo)
                                                    ? 'bg-emerald-50/50 border-emerald-100'
                                                    : 'bg-slate-50 border-slate-100',
                                            )}>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-bold text-slate-600">
                                                        {hasBankDetails(seller.bankInfo) ? 'Account on file' : 'Not provided'}
                                                    </p>
                                                    {hasBankDetails(seller.bankInfo) ? (
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-slate-400" />
                                                    )}
                                                </div>
                                                {hasBankDetails(seller.bankInfo) ? (
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900">{seller.bankInfo.bankName}</p>
                                                        <p className="text-xs font-bold text-slate-500 font-mono mt-0.5">{seller.bankInfo.accountNo}</p>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-500">Supplier has not added bank details yet.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ds-section-spacing">
                                        <div>
                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Operational Status</h5>
                                            <div className="p-6 bg-slate-900 rounded-xl text-white">
                                                <div className="flex items-center justify-between mb-6">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn(
                                                            'h-2 w-2 rounded-full',
                                                            seller.isActive && seller.isVerified ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500',
                                                        )} />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                                            {seller.isActive && seller.isVerified ? 'ACTIVE' : seller.isVerified ? 'INACTIVE' : 'PENDING'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="space-y-4 opacity-90">
                                                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                                                        <span className="text-xs font-bold">Verified</span>
                                                        <span className="text-xs font-black uppercase tracking-widest">{seller.isVerified ? 'Yes' : 'No'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                                                        <span className="text-xs font-bold">Account active</span>
                                                        <span className="text-xs font-black uppercase tracking-widest">{seller.isActive ? 'Yes' : 'No'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2">
                                                        <span className="text-xs font-bold">Service radius</span>
                                                        <span className="text-xs font-black uppercase tracking-widest">{seller.serviceRadius} km</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 bg-rose-50 rounded-xl border border-rose-100">
                                            <h5 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <XCircle className="h-4 w-4" />
                                                Safety Controls
                                            </h5>
                                            <p className="text-[10px] font-bold text-slate-500 leading-relaxed">Suspend this store immediately from the consumer app in case of policy violations.</p>
                                            <button className="w-full mt-4 py-3 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all">
                                                SUSPEND STORE
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Sidebar Context */}
                <div className="space-y-6">
                    {/* Owner Card */}
                    <Card className="p-4 border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl text-left">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden">
                                <User className="h-8 w-8 text-slate-300" />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-slate-900">{seller.ownerName}</h4>
                                <Badge variant="primary" className="text-[8px] font-black tracking-[0.2em] px-2">PARTNER</Badge>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-slate-500 hover:text-primary transition-colors cursor-pointer">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <Mail className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold">{seller.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-500 hover:text-primary transition-colors cursor-pointer">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <Phone className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold">{seller.phone}</span>
                            </div>
                            <div className="flex items-start gap-3 text-slate-500">
                                <div className="p-2 bg-slate-50 rounded-xl shrink-0">
                                    <MapPin className="h-4 w-4" />
                                </div>
                                <div>
                                    <span className="text-xs font-bold leading-relaxed block">{seller.locationLabel}</span>
                                    {seller.coordsLabel ? (
                                        <span className="text-[10px] text-slate-400 mt-1 block">GPS: {seller.coordsLabel}</span>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <button className="w-full mt-8 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all">
                            MESSAGE OWNER
                        </button>
                    </Card>

                    {/* Quick Notifications */}
                    <Card className="p-4 border-none shadow-xl ring-1 ring-slate-900 bg-slate-900 rounded-xl text-white">
                        <h4 className="text-[10px] font-bold opacity-40 uppercase tracking-[0.2em] mb-6">Strategic Comms</h4>
                        <div className="space-y-4">
                            <p className="text-xs font-medium text-slate-400 italic leading-relaxed">Send a high-priority push to the shop manager app.</p>
                            <textarea
                                placeholder="Message to store..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px]"
                            />
                            <button className="w-full py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                                SEND ALERT
                            </button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SellerDetail;
