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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';

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

    useEffect(() => {
        loadSettings();
        loadStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        loadReferrals(1, statusFilter, search);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, pageSize]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadReferrals(1, statusFilter, search);
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
        loadReferrals(page, statusFilter, search);
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
            </Card>

            {/* Referrals table */}
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
        </div>
    );
};

export default ReferralProgramPage;
