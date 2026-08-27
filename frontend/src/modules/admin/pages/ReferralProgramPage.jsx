import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Pagination from '@shared/components/ui/Pagination';
import {
    Gift,
    Users,
    Clock,
    CheckCircle2,
    XCircle,
    Wallet,
    Save,
    RotateCw,
    Search,
    Ban,
    Infinity as InfinityIcon,
    Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import { useDebouncedValue, DEBOUNCE_MS } from '@shared/hooks/useDebounce';

const STATUS_META = {
    pending: { label: 'Pending', variant: 'warning' },
    completed: { label: 'Completed', variant: 'success' },
    not_qualified: { label: "Didn't Qualify", variant: 'gray' },
    void: { label: 'Void', variant: 'danger' },
};

const ReferralProgramPage = () => {
    const [settings, setSettings] = useState({
        referralEnabled: false,
        referralSignupBonus: 0,
        referralBonus: 0,
        referralMinOrderValue: 0,
    });
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const [referrals, setReferrals] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [listLoading, setListLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('referrals');

    const [users, setUsers] = useState([]);
    const [usersTotal, setUsersTotal] = useState(0);
    const [usersPage, setUsersPage] = useState(1);
    const [usersPageSize, setUsersPageSize] = useState(25);
    const [usersSearch, setUsersSearch] = useState('');
    const [usersLoading, setUsersLoading] = useState(true);
    const [limitDrafts, setLimitDrafts] = useState({});
    const [lockDrafts, setLockDrafts] = useState({});
    const [savingLimitId, setSavingLimitId] = useState(null);
    const [bulkLimitValue, setBulkLimitValue] = useState('');
    const [bulkApplying, setBulkApplying] = useState(false);

    const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS.filter);
    const debouncedUsersSearch = useDebouncedValue(usersSearch, DEBOUNCE_MS.filter);

    const loadSettings = useCallback(async () => {
        setSettingsLoading(true);
        try {
            const res = await adminApi.getSettings();
            const s = res.data?.result || {};
            setSettings({
                referralEnabled: Boolean(s.referralEnabled),
                referralSignupBonus: Number(s.referralSignupBonus ?? 0),
                referralBonus: Number(s.referralBonus ?? 0),
                referralMinOrderValue: Number(s.referralMinOrderValue ?? 0),
            });
        } catch (err) {
            toast.error('Failed to load referral settings');
        } finally {
            setSettingsLoading(false);
        }
    }, []);

    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const res = await adminApi.getReferralStats();
            setStats(res.data?.result || null);
        } catch (err) {
            // non-fatal
        } finally {
            setStatsLoading(false);
        }
    }, []);

    const loadReferrals = useCallback(async (p = page, status = statusFilter, term = search) => {
        setListLoading(true);
        try {
            const res = await adminApi.getReferrals({
                page: p,
                limit: pageSize,
                status: status === 'all' ? undefined : status,
                search: term || undefined,
            });
            const payload = res.data?.result || {};
            setReferrals(Array.isArray(payload.items) ? payload.items : []);
            setTotal(payload.total || 0);
            setPage(payload.page || p);
        } catch (err) {
            toast.error('Failed to load referrals');
        } finally {
            setListLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    const loadUsers = useCallback(async (p = usersPage, term = usersSearch) => {
        setUsersLoading(true);
        try {
            const res = await adminApi.getReferralUsers({
                page: p,
                limit: usersPageSize,
                search: term || undefined,
            });
            const payload = res.data?.result || {};
            const items = Array.isArray(payload.items) ? payload.items : [];
            setUsers(items);
            setUsersTotal(payload.total || 0);
            setUsersPage(payload.page || p);
            setLimitDrafts((prev) => {
                const next = { ...prev };
                items.forEach((u) => {
                    next[u._id] = u.referralMaxAllowed === null || u.referralMaxAllowed === undefined
                        ? ''
                        : String(u.referralMaxAllowed);
                });
                return next;
            });
            setLockDrafts((prev) => {
                const next = { ...prev };
                items.forEach((u) => {
                    next[u._id] = Boolean(u.referralLimitLocked);
                });
                return next;
            });
        } catch (err) {
            toast.error('Failed to load users');
        } finally {
            setUsersLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usersPageSize]);

    useEffect(() => {
        loadSettings();
        loadStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        loadReferrals(1, statusFilter, debouncedSearch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, pageSize, debouncedSearch]);

    useEffect(() => {
        if (activeTab === 'users') {
            loadUsers(1, debouncedUsersSearch);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, usersPageSize, debouncedUsersSearch]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadReferrals(1, statusFilter, search);
    };

    const handleUsersSearchSubmit = (e) => {
        e.preventDefault();
        loadUsers(1, usersSearch);
    };

    const handleApplyLimitToAll = async () => {
        const raw = bulkLimitValue.trim();
        const value = raw === '' ? null : Number(raw);
        if (value !== null && (!Number.isFinite(value) || value < 0)) {
            toast.error('Enter a non-negative number, or leave blank for unlimited');
            return;
        }
        const label = value === null ? 'unlimited' : value;
        if (
            !window.confirm(
                `Set every user's referral limit to ${label}? This overwrites any custom limits already set per user.`,
            )
        ) {
            return;
        }
        setBulkApplying(true);
        try {
            const res = await adminApi.bulkSetReferralLimit(value);
            if (res.data?.success !== false) {
                const { modified = 0, skipped = 0 } = res.data?.result || {};
                toast.success(
                    skipped > 0
                        ? `Referral limit applied to ${modified} user(s). ${skipped} locked user(s) were skipped.`
                        : `Referral limit applied to ${modified} user(s)`,
                );
                if (activeTab === 'users') loadUsers(usersPage, usersSearch);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to apply referral limit');
        } finally {
            setBulkApplying(false);
        }
    };

    const handleSaveLimit = async (userId) => {
        const raw = limitDrafts[userId];
        const value = raw === '' || raw === undefined || raw === null ? null : Number(raw);
        if (value !== null && (!Number.isFinite(value) || value < 0)) {
            toast.error('Enter a non-negative number, or leave blank for unlimited');
            return;
        }
        const locked = Boolean(lockDrafts[userId]);
        setSavingLimitId(userId);
        try {
            const res = await adminApi.updateUserReferralLimit(userId, value, locked);
            const updated = res.data?.result;
            if (res.data?.success !== false) {
                toast.success('Referral limit updated');
                setUsers((prev) =>
                    prev.map((u) =>
                        u._id === userId
                            ? {
                                ...u,
                                referralMaxAllowed: updated?.referralMaxAllowed ?? value,
                                referralLimitLocked: updated?.referralLimitLocked ?? locked,
                            }
                            : u,
                    ),
                );
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update referral limit');
        } finally {
            setSavingLimitId(null);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            const res = await adminApi.updateSettings({
                referralEnabled: settings.referralEnabled,
                referralSignupBonus: Number(settings.referralSignupBonus) || 0,
                referralBonus: Number(settings.referralBonus) || 0,
                referralMinOrderValue: Number(settings.referralMinOrderValue) || 0,
            });
            if (res.data?.success !== false) {
                toast.success('Referral settings updated');
                loadStats();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const refreshAll = () => {
        loadSettings();
        loadStats();
        if (activeTab === 'users') {
            loadUsers(usersPage, usersSearch);
        } else {
            loadReferrals(page, statusFilter, search);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const usersTotalPages = Math.max(1, Math.ceil(usersTotal / usersPageSize));

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Referral Program
                        <Badge variant="primary" className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider">
                            {settings.referralEnabled ? 'Live' : 'Disabled'}
                        </Badge>
                    </h1>
                    <p className="ds-description mt-1">Configure bonuses and track every referral end-to-end.</p>
                </div>
                <button
                    onClick={refreshAll}
                    className="p-2.5 bg-white ring-1 ring-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm w-fit"
                >
                    <RotateCw className={cn('h-4 w-4', (settingsLoading || statsLoading || listLoading) && 'animate-spin')} />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {[
                    { label: 'Total Referrals', value: stats?.total ?? 0, icon: Users, bg: 'bg-sky-50', color: 'text-sky-500' },
                    { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, bg: 'bg-amber-50', color: 'text-amber-500' },
                    { label: 'Completed', value: stats?.completed ?? 0, icon: CheckCircle2, bg: 'bg-emerald-50', color: 'text-emerald-500' },
                    { label: 'Bonuses Paid', value: `₹${((stats?.referrerBonusPaid || 0) + (stats?.refereeSignupBonusPaid || 0)).toLocaleString()}`, icon: Wallet, bg: 'bg-fuchsia-50', color: 'text-fuchsia-500' },
                ].map((s, i) => (
                    <Card key={i} className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white">
                        <div className="flex items-center gap-3">
                            <div className={cn('p-2.5 rounded-xl', s.bg)}>
                                <s.icon className={cn('h-5 w-5', s.color)} />
                            </div>
                            <div>
                                <p className="ds-label mb-0.5">{s.label}</p>
                                <h3 className="text-lg font-black text-slate-900">{s.value}</h3>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Settings panel */}
            <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-2xl">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <Gift className="h-5 w-5 text-fuchsia-500" />
                        <h2 className="text-base font-black text-slate-900">Program Settings</h2>
                    </div>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                            {settings.referralEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={settings.referralEnabled}
                            onClick={() => setSettings((s) => ({ ...s, referralEnabled: !s.referralEnabled }))}
                            className={cn(
                                'relative h-6 w-11 rounded-full transition-colors shrink-0',
                                settings.referralEnabled ? 'bg-emerald-500' : 'bg-slate-300',
                            )}
                        >
                            <span
                                className={cn(
                                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                                    settings.referralEnabled ? 'translate-x-[22px]' : 'translate-x-0.5',
                                )}
                            />
                        </button>
                    </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                            New User Signup Bonus (₹)
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={settings.referralSignupBonus}
                            onChange={(e) => setSettings((s) => ({ ...s, referralSignupBonus: e.target.value }))}
                            className="w-full px-4 py-3 bg-slate-50 ring-1 ring-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <p className="text-[10px] text-slate-400 mt-1.5">Credited instantly when a valid code is redeemed.</p>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                            Referrer Bonus (₹)
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={settings.referralBonus}
                            onChange={(e) => setSettings((s) => ({ ...s, referralBonus: e.target.value }))}
                            className="w-full px-4 py-3 bg-slate-50 ring-1 ring-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <p className="text-[10px] text-slate-400 mt-1.5">Paid once the referred user's first order qualifies.</p>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                            Minimum First Order Value (₹)
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={settings.referralMinOrderValue}
                            onChange={(e) => setSettings((s) => ({ ...s, referralMinOrderValue: e.target.value }))}
                            className="w-full px-4 py-3 bg-slate-50 ring-1 ring-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <p className="text-[10px] text-slate-400 mt-1.5">Referrer bonus only releases above this order value.</p>
                    </div>
                </div>

                <div className="flex justify-end mt-5">
                    <button
                        onClick={handleSaveSettings}
                        disabled={saving || settingsLoading}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50"
                    >
                        {saving ? <RotateCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Settings
                    </button>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                        Referral Limit (per user)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                        <input
                            type="number"
                            min={0}
                            placeholder="Unlimited"
                            value={bulkLimitValue}
                            onChange={(e) => setBulkLimitValue(e.target.value)}
                            className="w-full sm:w-48 px-4 py-3 bg-slate-50 ring-1 ring-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button
                            onClick={handleApplyLimitToAll}
                            disabled={bulkApplying}
                            className="flex items-center justify-center gap-2 px-5 py-3 bg-fuchsia-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-fuchsia-700 transition-all shadow-lg disabled:opacity-50 shrink-0"
                        >
                            {bulkApplying ? <RotateCw className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                            Apply to All Users
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                        Sets how many referrals every user is allowed to give, in one go — leave blank for unlimited, or 0 to block everyone. Overwrites any limits already set per user in the "All Users" tab below.
                    </p>
                </div>
            </Card>

            {/* Section tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                {[
                    { key: 'referrals', label: 'Referrals' },
                    { key: 'users', label: 'All Users' },
                ].map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={cn(
                            'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tight transition-all',
                            activeTab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600',
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Referrals table */}
            {activeTab === 'referrals' && (
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <form onSubmit={handleSearchSubmit} className="relative group w-full md:w-72">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, phone, or code..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10 w-full transition-all"
                        />
                    </form>
                    <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                        {['all', 'pending', 'completed', 'not_qualified'].map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all',
                                    statusFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600',
                                )}
                            >
                                {s === 'not_qualified' ? "Didn't Qualify" : s}
                            </button>
                        ))}
                    </div>
                </div>

                <Card className="border-none shadow-2xl ring-1 ring-slate-100 overflow-hidden bg-white rounded-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="ds-table-header-cell pl-8">Referrer</th>
                                    <th className="ds-table-header-cell">Referee</th>
                                    <th className="ds-table-header-cell">Code</th>
                                    <th className="ds-table-header-cell text-center">Status</th>
                                    <th className="ds-table-header-cell text-right">Signup Bonus</th>
                                    <th className="ds-table-header-cell text-right pr-8">Referrer Bonus</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {referrals.map((r) => {
                                    const meta = STATUS_META[r.status] || { label: r.status, variant: 'default' };
                                    return (
                                        <tr key={r._id} className="hover:bg-slate-50/30 transition-all">
                                            <td className="px-6 py-4 pl-8">
                                                <p className="text-sm font-bold text-slate-900">{r.referrer?.name || 'Unknown'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{r.referrer?.phone}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-bold text-slate-900">{r.referee?.name || 'Unknown'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{r.referee?.phone}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-mono font-bold text-slate-500">{r.referralCode}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Badge variant={meta.variant} className="text-[9px] font-black px-3 py-1 uppercase tracking-wider">
                                                    {meta.label}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <p className="text-sm font-black text-slate-900">₹{Number(r.refereeSignupBonus || 0).toLocaleString()}</p>
                                            </td>
                                            <td className="px-6 py-4 text-right pr-8">
                                                <p className={cn('text-sm font-black', r.status === 'completed' ? 'text-emerald-600' : 'text-slate-400')}>
                                                    ₹{Number(r.referrerBonus || 0).toLocaleString()}
                                                </p>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {referrals.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="p-4 bg-slate-50 rounded-full mb-4">
                                                    <Gift className="h-8 w-8 text-slate-200" />
                                                </div>
                                                <p className="text-slate-400 font-bold text-sm">
                                                    {listLoading ? 'Loading referrals...' : 'No referrals found.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-6 py-3 border-t border-slate-100">
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            total={total}
                            pageSize={pageSize}
                            onPageChange={(p) => loadReferrals(p, statusFilter, search)}
                            onPageSizeChange={(newSize) => {
                                setPageSize(newSize);
                            }}
                            loading={listLoading}
                        />
                    </div>
                </Card>
            </div>
            )}

            {/* All Users table */}
            {activeTab === 'users' && (
            <div className="space-y-4">
                <div className="flex flex-col gap-2">
                    <form onSubmit={handleUsersSearchSubmit} className="relative group w-full md:w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, phone, or code..."
                            value={usersSearch}
                            onChange={(e) => setUsersSearch(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10 w-full transition-all"
                        />
                    </form>
                    <p className="text-[11px] font-semibold text-slate-400 md:w-96">
                        Set how many referrals each user is allowed to give — leave blank for unlimited, or 0 to block them.
                        Check the <Lock className="inline h-3 w-3 -mt-0.5" /> lock next to a user to keep their limit unchanged when you apply a limit to all users.
                    </p>
                </div>

                <Card className="border-none shadow-2xl ring-1 ring-slate-100 overflow-hidden bg-white rounded-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="ds-table-header-cell pl-8">User</th>
                                    <th className="ds-table-header-cell">Code</th>
                                    <th className="ds-table-header-cell text-center">Given</th>
                                    <th className="ds-table-header-cell text-right">Bonus Earned</th>
                                    <th
                                        className="ds-table-header-cell text-center pr-8"
                                        title="Check the lock to protect a user's limit from the 'Apply to All Users' bulk update"
                                    >
                                        Referral Limit
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {users.map((u) => {
                                    const draft = limitDrafts[u._id] ?? '';
                                    const currentValue = u.referralMaxAllowed === null || u.referralMaxAllowed === undefined
                                        ? ''
                                        : String(u.referralMaxAllowed);
                                    const lockDraft = Boolean(lockDrafts[u._id]);
                                    const isDirty = draft !== currentValue || lockDraft !== Boolean(u.referralLimitLocked);
                                    const isBlocked = u.referralMaxAllowed === 0;
                                    return (
                                        <tr key={u._id} className="hover:bg-slate-50/30 transition-all">
                                            <td className="px-6 py-4 pl-8">
                                                <p className="text-sm font-bold text-slate-900">{u.name || 'Unknown'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{u.phone}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-mono font-bold text-slate-500">{u.referralCode || '—'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <p className="text-sm font-black text-slate-900">{u.referralStats?.total || 0}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                    {u.referralStats?.completed || 0} completed
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <p className="text-sm font-black text-emerald-600">
                                                    ₹{Number(u.referralStats?.bonusEarned || 0).toLocaleString()}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 pr-8">
                                                <div className="flex items-center justify-center gap-2">
                                                    {isBlocked ? (
                                                        <Badge variant="danger" className="text-[9px] font-black px-2 py-1 uppercase tracking-wider flex items-center gap-1">
                                                            <Ban className="h-3 w-3" /> Blocked
                                                        </Badge>
                                                    ) : currentValue === '' ? (
                                                        <Badge variant="gray" className="text-[9px] font-black px-2 py-1 uppercase tracking-wider flex items-center gap-1">
                                                            <InfinityIcon className="h-3 w-3" /> Unlimited
                                                        </Badge>
                                                    ) : null}
                                                    <label
                                                        className={cn(
                                                            'flex items-center justify-center h-8 w-8 rounded-lg ring-1 transition-all cursor-pointer shrink-0',
                                                            lockDraft
                                                                ? 'bg-amber-50 ring-amber-300 text-amber-600'
                                                                : 'bg-slate-50 ring-slate-200 text-slate-300 hover:text-slate-400',
                                                        )}
                                                        title="Protect this user's limit from the 'Apply to All Users' bulk update"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only"
                                                            checked={lockDraft}
                                                            onChange={(e) =>
                                                                setLockDrafts((prev) => ({ ...prev, [u._id]: e.target.checked }))
                                                            }
                                                        />
                                                        <Lock className="h-3.5 w-3.5" />
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        placeholder="∞"
                                                        value={draft}
                                                        onChange={(e) =>
                                                            setLimitDrafts((prev) => ({ ...prev, [u._id]: e.target.value }))
                                                        }
                                                        className="w-20 px-3 py-2 bg-slate-50 ring-1 ring-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                    <button
                                                        onClick={() => handleSaveLimit(u._id)}
                                                        disabled={!isDirty || savingLimitId === u._id}
                                                        className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Save referral limit"
                                                    >
                                                        {savingLimitId === u._id ? (
                                                            <RotateCw className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Save className="h-3.5 w-3.5" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="p-4 bg-slate-50 rounded-full mb-4">
                                                    <Users className="h-8 w-8 text-slate-200" />
                                                </div>
                                                <p className="text-slate-400 font-bold text-sm">
                                                    {usersLoading ? 'Loading users...' : 'No users found.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-6 py-3 border-t border-slate-100">
                        <Pagination
                            page={usersPage}
                            totalPages={usersTotalPages}
                            total={usersTotal}
                            pageSize={usersPageSize}
                            onPageChange={(p) => loadUsers(p, usersSearch)}
                            onPageSizeChange={(newSize) => {
                                setUsersPageSize(newSize);
                            }}
                            loading={usersLoading}
                        />
                    </div>
                </Card>
            </div>
            )}
        </div>
    );
};

export default ReferralProgramPage;
