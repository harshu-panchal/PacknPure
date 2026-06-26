import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import PageHeader from '@shared/components/ui/PageHeader';
import StatCard from '@shared/components/ui/StatCard';
import {
    Users,
    Search,
    Download,
    Eye,
    Phone,
    ShoppingBag,
    MoreVertical,
    UserPlus,
    RotateCw,
    Activity,
    Loader2,
    Ban,
    CheckCircle2,
    UserX,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import { useDebouncedValue, DEBOUNCE_MS } from '@shared/hooks/useDebounce';

const getCustomerAvatarUrl = (cust) => {
    const url = cust?.avatar?.trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        return url;
    }
    const seed = encodeURIComponent(cust?.phone || cust?.name || 'Customer');
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
};

const CustomerManagement = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebouncedValue(searchTerm, DEBOUNCE_MS.filter);
    const [filterStatus, setFilterStatus] = useState('all');
    const [isExporting, setIsExporting] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [codUpdatingId, setCodUpdatingId] = useState('');
    const [accountUpdatingId, setAccountUpdatingId] = useState('');

    useEffect(() => {
        fetchCustomers(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    const fetchCustomers = async (requestedPage = 1) => {
        try {
            setLoading(true);
            const { data } = await adminApi.getUsers({ page: requestedPage, limit: pageSize });
            if (data.success) {
                const payload = data.result || {};
                const list = Array.isArray(payload.items) ? payload.items : (data.results || []);
                setCustomers(list);
                if (typeof payload.total === 'number') {
                    setTotal(payload.total);
                } else {
                    setTotal(list.length);
                }
                if (typeof payload.page === 'number') {
                    setPage(payload.page);
                } else {
                    setPage(requestedPage);
                }
            }
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast.error("Failed to load customers");
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const safeCustomers = Array.isArray(customers) ? customers : [];
        return {
            total: total,
            active: safeCustomers.filter(c => c.status === 'active').length,
            newToday: safeCustomers.filter(c => {
                const today = new Date().toISOString().split('T')[0];
                const joined = new Date(c.joinedDate).toISOString().split('T')[0];
                return joined === today;
            }).length
        };
    }, [customers, total]);

    const filteredCustomers = useMemo(() => {
        const safeCustomers = Array.isArray(customers) ? customers : [];
        return safeCustomers.filter(c => {
            const q = debouncedSearchTerm.toLowerCase();
            const matchesSearch = (c.name || '').toLowerCase().includes(q) ||
                (c.email || '').toLowerCase().includes(q) ||
                (c.phone || '').includes(debouncedSearchTerm);
            const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [customers, debouncedSearchTerm, filterStatus]);

    const handleExport = () => {
        setIsExporting(true);
        setTimeout(() => {
            setIsExporting(false);
            toast.success('Customer database exported successfully!');
        }, 1500);
    };

    const handleToggleCod = async (customer) => {
        try {
            setCodUpdatingId(String(customer.id));
            const nextBlocked = !customer.codBlocked;
            await adminApi.updateUserCodPolicy(customer.id, {
                codBlocked: nextBlocked,
                resetCancelCount: !nextBlocked,
            });
            toast.success(nextBlocked ? 'COD blocked (user can still login)' : 'COD enabled for customer');
            await fetchCustomers(page);
        } catch (error) {
            console.error("Failed to update COD policy:", error);
            toast.error(error?.response?.data?.message || "Failed to update COD policy");
        } finally {
            setCodUpdatingId('');
        }
    };

    /** Suspend account — user cannot login (`isActive: false`) */
    const handleToggleAccountSuspend = async (customer) => {
        const willSuspend = customer.status === 'active';
        try {
            setAccountUpdatingId(String(customer.id));
            await adminApi.updateUserStatus(customer.id, { isActive: !willSuspend });
            toast.success(
                willSuspend
                    ? 'Account suspended — user cannot login'
                    : 'Account activated — user can login again',
            );
            await fetchCustomers(page);
        } catch (error) {
            console.error('Failed to update account status:', error);
            toast.error(error?.response?.data?.message || 'Failed to update account status');
        } finally {
            setAccountUpdatingId('');
        }
    };

    const getTimeAgo = (date) => {
        if (!date) return 'Never';
        const now = new Date();
        const past = new Date(date);
        const diffInMs = now - past;
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

        if (diffInHours < 1) return 'Recently';
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    };

    return (
        <div className="ds-section-spacing">
            <PageHeader
                title="Customers"
                description="Manage and track all customer accounts"
                badge={
                    <div className="ds-stat-card-icon bg-sky-50">
                        <Users className="ds-icon-lg text-sky-600" />
                    </div>
                }
                actions={
                    <>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="ds-btn ds-btn-md bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                            {isExporting ? <RotateCw className="ds-icon-sm animate-spin" /> : <Download className="ds-icon-sm" />}
                            {isExporting ? 'EXPORTING...' : 'EXPORT'}
                        </button>
                    </>
                }
            />

            {/* Quick Stats Grid */}
            <div className="ds-grid-cards-3">
                <StatCard
                    label="Total Customers"
                    value={stats.total}
                    icon={Users}
                    color="text-sky-600"
                    bg="bg-sky-50"
                />
                <StatCard
                    label="Active Users"
                    value={stats.active}
                    icon={Activity}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
                <StatCard
                    label="New Today"
                    value={stats.newToday}
                    icon={UserPlus}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                />
            </div>

            {/* Filter & Search Bar */}
            <Card className="ds-card-compact">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 ds-icon-sm text-gray-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name, email or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="ds-input pl-9"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-100 p-0.5 rounded-lg">
                            {['all', 'active', 'inactive'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md ds-caption transition-all",
                                        filterStatus === status ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Customer List Table */}
            <Card className="overflow-hidden relative min-h-[400px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <p className="ds-caption text-gray-500 font-medium">Loading Customers...</p>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="ds-table">
                        <thead className="ds-table-header">
                            <tr>
                                <th className="ds-table-header-cell">Customer</th>
                                <th className="ds-table-header-cell">Activity</th>
                                <th className="ds-table-header-cell">Total Spend</th>
                                <th className="ds-table-header-cell">Account</th>
                                <th className="ds-table-header-cell">COD pay</th>
                                <th className="ds-table-header-cell text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-gray-50 rounded-full">
                                                <Users className="h-8 w-8 text-gray-300" />
                                            </div>
                                            <p className="ds-h4 text-gray-400">No customers found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((cust) => (
                                    <tr key={cust.id} className="ds-table-row">
                                        <td className="ds-table-cell">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={getCustomerAvatarUrl(cust)}
                                                    alt={cust.name || 'Customer'}
                                                    className="h-10 w-10 rounded-lg bg-gray-100 ring-2 ring-white shadow-sm object-cover"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = getCustomerAvatarUrl({
                                                            ...cust,
                                                            avatar: '',
                                                        });
                                                    }}
                                                />
                                                <div>
                                                    <p
                                                        onClick={() => navigate(`/admin/customers/${cust.id}`)}
                                                        className="ds-h4 hover:text-primary cursor-pointer transition-colors"
                                                    >
                                                        {cust.name}
                                                    </p>
                                                    <p className="ds-body-sm text-gray-500">{cust.email || 'No email'}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Phone className="ds-icon-sm text-gray-300" />
                                                        <span className="text-[9px] text-gray-400">{cust.phone}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="ds-table-cell">
                                            <div>
                                                <div className="flex items-center gap-1.5 ds-body font-semibold">
                                                    <ShoppingBag className="ds-icon-sm text-primary" />
                                                    {cust.totalOrders} Orders
                                                </div>
                                                <p className="ds-body-sm text-gray-400 mt-0.5">Last: {getTimeAgo(cust.lastOrderDate)}</p>
                                            </div>
                                        </td>
                                        <td className="ds-table-cell ds-h4">
                                            ₹{(cust.totalSpent || 0).toLocaleString()}
                                        </td>
                                        <td className="ds-table-cell">
                                            <Badge
                                                variant={cust.status === 'active' ? 'success' : 'error'}
                                                className="ds-badge"
                                            >
                                                {cust.status}
                                            </Badge>
                                        </td>
                                        <td className="ds-table-cell">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={cust.codBlocked ? 'error' : 'success'}
                                                    className="ds-badge"
                                                >
                                                    {cust.codBlocked ? 'blocked' : 'enabled'}
                                                </Badge>
                                                <span className="text-[10px] text-gray-500 font-semibold">
                                                    strikes: {Number(cust.codCancelCount || 0)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="ds-table-cell text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/customers/${cust.id}`)}
                                                    className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all"
                                                >
                                                    <Eye className="ds-icon-sm" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleAccountSuspend(cust)}
                                                    disabled={accountUpdatingId === String(cust.id)}
                                                    className={cn(
                                                        'p-2 rounded-lg transition-all',
                                                        cust.status === 'active'
                                                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white'
                                                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white',
                                                    )}
                                                    title={
                                                        cust.status === 'active'
                                                            ? 'Suspend account (blocks login)'
                                                            : 'Activate account'
                                                    }
                                                >
                                                    {accountUpdatingId === String(cust.id) ? (
                                                        <Loader2 className="ds-icon-sm animate-spin" />
                                                    ) : cust.status === 'active' ? (
                                                        <UserX className="ds-icon-sm" />
                                                    ) : (
                                                        <CheckCircle2 className="ds-icon-sm" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleToggleCod(cust)}
                                                    disabled={codUpdatingId === String(cust.id)}
                                                    className={cn(
                                                        "p-2 rounded-lg transition-all",
                                                        cust.codBlocked
                                                            ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                                                            : "bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white",
                                                    )}
                                                    title={cust.codBlocked ? "Enable COD payments" : "Block COD only (login allowed)"}
                                                >
                                                    {codUpdatingId === String(cust.id) ? (
                                                        <Loader2 className="ds-icon-sm animate-spin" />
                                                    ) : cust.codBlocked ? (
                                                        <CheckCircle2 className="ds-icon-sm" />
                                                    ) : (
                                                        <Ban className="ds-icon-sm" />
                                                    )}
                                                </button>
                                                <button className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-900 hover:text-white transition-all">
                                                    <MoreVertical className="ds-icon-sm" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 border-t border-gray-100">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchCustomers(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={loading}
                    />
                </div>
            </Card>
        </div>
    );
};

export default CustomerManagement;
