import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import {
    ArrowLeft, User, Phone, MapPin, Truck, Wallet, Package,
    ShieldCheck, ShieldAlert, Calendar, Clock, Building2, CircleDollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const InfoRow = ({ icon: Icon, label, value, mono = false }) => (
    <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
            <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className={cn("text-sm font-bold text-slate-900 truncate", mono && "font-mono tracking-wide")}>
                {value || <span className="text-slate-300 font-semibold">Not provided</span>}
            </p>
        </div>
    </div>
);

const statusVariant = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'active') return 'success';
    if (s === 'inactive') return 'neutral';
    return 'warning';
};

const PICKUP_STATUS_META = {
    pickup_assigned: { label: 'Assigned', variant: 'warning' },
    picked: { label: 'Picked Up', variant: 'primary' },
    hub_delivered: { label: 'Delivered to Hub', variant: 'success' },
    received_at_hub: { label: 'Received at Hub', variant: 'success' },
    verified: { label: 'Verified', variant: 'success' },
    closed: { label: 'Closed', variant: 'success' },
    pickup_cancelled: { label: 'Cancelled', variant: 'danger' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
};

const PickupPartnerProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    useEffect(() => {
        fetchProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const response = await adminApi.getPickupPartnerById(id);
            setData(response.data.result);
        } catch (error) {
            console.error('Error fetching pickup partner:', error);
            toast.error('Failed to load pickup partner profile');
            navigate('/admin/pickup-partners');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="h-12 w-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Loading Profile...</p>
            </div>
        );
    }

    if (!data || !data.partner) {
        return (
            <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <User className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                <p className="text-sm font-bold text-slate-500">Pickup partner not found.</p>
            </div>
        );
    }

    const { partner, stats, recentPickups } = data;

    return (
        <div className="ds-section-spacing animate-in fade-in duration-700">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="p-3 bg-white rounded-2xl ring-1 ring-slate-200 hover:ring-primary/50 text-slate-500 hover:text-primary transition-all shadow-sm active:scale-95"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Pickup Partner Profile
                        {partner.isOnline && (
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                    </h1>
                    <p className="ds-description mt-1">Detailed overview and pickup performance history.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column: Profile Card */}
                <div className="xl:col-span-1 space-y-6">
                    <Card className="p-8 border-none shadow-xl ring-1 ring-slate-100 relative overflow-hidden bg-white">
                        <div className="absolute top-0 right-0 p-6 flex justify-end">
                            <Badge variant={partner.isOnline ? 'success' : 'neutral'} className="uppercase font-black text-[10px] px-3 shadow-sm">
                                {partner.isOnline ? 'Online' : 'Offline'}
                            </Badge>
                        </div>
                        <div className="flex flex-col items-center text-center mt-4">
                            <div className="relative mb-6">
                                <div className="h-28 w-28 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 shadow-inner overflow-hidden">
                                    <User className="h-14 w-14" />
                                </div>
                                <div className={cn(
                                    "absolute -bottom-2 -right-2 h-8 w-8 rounded-full border-4 border-white shadow-md flex items-center justify-center",
                                    partner.isVerified ? "bg-emerald-500 text-white" : "bg-slate-300"
                                )}>
                                    <ShieldCheck className="h-4 w-4" />
                                </div>
                            </div>
                            <h2 className="text-xl font-black text-slate-900">{partner.name}</h2>
                            <div className="mt-2">
                                <Badge variant={statusVariant(partner.status)} className="uppercase font-black text-[10px] px-3">
                                    {partner.status || 'available'}
                                </Badge>
                            </div>

                            <div className="w-full h-px bg-slate-100 my-6" />

                            <div className="w-full space-y-4 text-left">
                                <InfoRow icon={Phone} label="Phone" value={partner.phone} />
                                <InfoRow icon={Truck} label="Vehicle" value={partner.vehicleType} />
                                <InfoRow icon={Building2} label="Hub" value={partner.hubId} />
                                <InfoRow icon={MapPin} label="Address" value={partner.address} />
                                <InfoRow
                                    icon={partner.isVerified ? ShieldCheck : ShieldAlert}
                                    label="Verification Status"
                                    value={partner.isVerified ? 'Verified' : 'Pending Verification'}
                                />
                                <InfoRow
                                    icon={Calendar}
                                    label="Joined On"
                                    value={partner.createdAt ? new Date(partner.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null}
                                />
                                <InfoRow
                                    icon={Clock}
                                    label="Last Login"
                                    value={partner.lastLogin ? new Date(partner.lastLogin).toLocaleString() : null}
                                />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white">
                        <h3 className="text-sm font-black text-slate-900 mb-5">Payment Configuration</h3>
                        <div className="space-y-4">
                            <InfoRow
                                icon={CircleDollarSign}
                                label="Payment Model"
                                value={partner.paymentType === 'salary' ? 'Fixed Salary' : 'Distance / Trip Based'}
                            />
                            {partner.paymentType === 'salary' ? (
                                <InfoRow icon={Wallet} label="Monthly Salary" value={`₹${Number(partner.salaryAmount || 0).toLocaleString()}`} />
                            ) : (
                                <>
                                    <InfoRow icon={Wallet} label="Base Fee / Trip" value={`₹${Number(partner.baseTripRate || 0).toLocaleString()}`} />
                                    <InfoRow icon={Wallet} label="Rate / KM" value={`₹${Number(partner.perKmRate || 0).toLocaleString()}`} />
                                </>
                            )}
                            <InfoRow icon={Wallet} label="Wallet Balance" value={`₹${Number(partner.walletBalance || 0).toLocaleString()}`} />
                        </div>
                    </Card>
                </div>

                {/* Right Column: Stats & Pickup History */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all text-center">
                            <div className="mx-auto h-10 w-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Package className="h-5 w-5" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Assigned</p>
                            <p className="text-xl font-black text-slate-900 mt-1">{stats.totalAssigned}</p>
                        </Card>
                        <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all text-center">
                            <div className="mx-auto h-10 w-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Truck className="h-5 w-5" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Now</p>
                            <p className="text-xl font-black text-slate-900 mt-1">{stats.activeAssigned}</p>
                        </Card>
                        <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all text-center">
                            <div className="mx-auto h-10 w-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed</p>
                            <p className="text-xl font-black text-slate-900 mt-1">{stats.completed}</p>
                        </Card>
                        <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all text-center">
                            <div className="mx-auto h-10 w-10 bg-violet-50 text-violet-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Wallet className="h-5 w-5" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wallet</p>
                            <p className="text-xl font-black text-slate-900 mt-1">₹{stats.walletBalance}</p>
                        </Card>
                    </div>

                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-sm font-black text-slate-900">Recent Pickups</h3>
                            <Badge variant="neutral" className="text-[10px]">Last 50</Badge>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left whitespace-nowrap">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <th className="px-6 py-4">Request ID</th>
                                        <th className="px-6 py-4">Date & Time</th>
                                        <th className="px-6 py-4">Vendor</th>
                                        <th className="px-6 py-4">Items</th>
                                        <th className="px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {recentPickups && recentPickups.length > 0 ? (
                                        recentPickups.map((pr) => {
                                            const meta = PICKUP_STATUS_META[pr.status] || { label: pr.status, variant: 'neutral' };
                                            return (
                                                <tr key={pr._id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-bold text-indigo-600">{pr.requestId}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-xs font-bold text-slate-900">
                                                            {pr.assignedAt ? new Date(pr.assignedAt).toLocaleDateString() : '—'}
                                                        </div>
                                                        <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                                            {pr.assignedAt ? new Date(pr.assignedAt).toLocaleTimeString() : ''}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-bold text-slate-900">{pr.vendorName}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-semibold text-slate-600">{pr.itemCount} items</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge variant={meta.variant} className="uppercase font-black text-[9px] px-2">
                                                            {meta.label}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                <Package className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                                                <p className="text-xs font-bold text-slate-500">No pickups assigned yet.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default PickupPartnerProfile;
