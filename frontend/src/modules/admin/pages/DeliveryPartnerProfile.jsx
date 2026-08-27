import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import {
    ArrowLeft, User, Phone, MapPin, Truck, Star, DollarSign,
    ShieldCheck, ShieldAlert, Clock, Calendar, Activity, Package,
    Mail, CreditCard, FileText, Landmark, IdCard, ExternalLink, ImageOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const GeocodedLocation = ({ log }) => {
    const [areaName, setAreaName] = useState(log.area);
    const [isLoading, setIsLoading] = useState(!log.area && log.location?.coordinates);

    useEffect(() => {
        if (log.area) {
            setAreaName(log.area);
            setIsLoading(false);
            return;
        }
        if (log.location && log.location.coordinates) {
            const lat = log.location.coordinates[1];
            const lon = log.location.coordinates[0];
            
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`)
                .then(res => res.json())
                .then(data => {
                    if (data) {
                        const area = data.locality || data.city || data.principalSubdivision || "Unknown Area";
                        setAreaName(area);
                    } else {
                        setAreaName("Unknown Area");
                    }
                })
                .catch(err => {
                    console.error('Geocoding error:', err);
                    setAreaName("Unknown Area");
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            setIsLoading(false);
        }
    }, [log]);

    if (isLoading) return <span className="text-slate-300 animate-pulse">Locating...</span>;
    if (areaName) return <>{areaName}</>;
    return <>Unknown Area</>;
};

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

const DocumentTile = ({ label, url }) => (
    <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        {url ? (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block h-28 rounded-2xl overflow-hidden bg-slate-50 ring-1 ring-slate-100 hover:ring-primary/40 transition-all"
            >
                <img src={url} alt={label} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </a>
        ) : (
            <div className="h-28 rounded-2xl bg-slate-50 ring-1 ring-slate-100 flex flex-col items-center justify-center text-slate-300 gap-1.5">
                <ImageOff className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Not uploaded</span>
            </div>
        )}
    </div>
);

const DeliveryPartnerProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [partnerData, setPartnerData] = useState(null);
    const [rideFilter, setRideFilter] = useState('all');

    // Stat cards double as shortcut filters onto the Recent Rides table below.
    const filteredOrders = useMemo(() => {
        const orders = partnerData?.recentOrders || [];
        if (rideFilter === 'delivered') return orders.filter((o) => o.status === 'delivered');
        if (rideFilter === 'today') {
            const todayStr = new Date().toDateString();
            return orders.filter((o) => o.status === 'delivered' && new Date(o.createdAt).toDateString() === todayStr);
        }
        if (rideFilter === 'rated') return orders.filter((o) => Boolean(o.deliveryRating));
        return orders;
    }, [partnerData, rideFilter]);

    useEffect(() => {
        fetchPartnerDetails();
    }, [id]);

    const fetchPartnerDetails = async () => {
        setLoading(true);
        try {
            const response = await adminApi.getDeliveryPartnerById(id);
            setPartnerData(response.data.result);
        } catch (error) {
            console.error('Error fetching delivery partner:', error);
            toast.error('Failed to load delivery partner profile');
            navigate('/admin/delivery-boys/active');
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

    if (!partnerData || !partnerData.rider) {
        return (
            <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <User className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                <p className="text-sm font-bold text-slate-500">Delivery Partner not found.</p>
            </div>
        );
    }

    const { rider, stats, activityLogs } = partnerData;

    return (
        <div className="ds-section-spacing animate-in fade-in duration-700">
            {/* Header & Back Navigation */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="p-3 bg-white rounded-2xl ring-1 ring-slate-200 hover:ring-primary/50 text-slate-500 hover:text-primary transition-all shadow-sm active:scale-95"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Rider Profile
                        {rider.isOnline && (
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                    </h1>
                    <p className="ds-description mt-1">Detailed overview and performance history.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column: Profile Card */}
                <div className="xl:col-span-1 space-y-6">
                    <Card className="p-8 border-none shadow-xl ring-1 ring-slate-100 relative overflow-hidden bg-white">
                        <div className="absolute top-0 right-0 p-6 flex justify-end">
                            <Badge variant={rider.isOnline ? 'success' : 'neutral'} className="uppercase font-black text-[10px] px-3 shadow-sm">
                                {rider.isOnline ? 'Online' : 'Offline'}
                            </Badge>
                        </div>
                        <div className="flex flex-col items-center text-center mt-4">
                            <div className="relative mb-6">
                                <div className="h-28 w-28 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 shadow-inner overflow-hidden">
                                    {rider.documents?.profileImage ? (
                                        <img
                                            src={rider.documents.profileImage}
                                            alt={rider.name}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <User className="h-14 w-14" />
                                    )}
                                </div>
                                <div className={cn(
                                    "absolute -bottom-2 -right-2 h-8 w-8 rounded-full border-4 border-white shadow-md flex items-center justify-center",
                                    rider.isVerified ? "bg-emerald-500 text-white" : "bg-slate-300"
                                )}>
                                    <ShieldCheck className="h-4 w-4" />
                                </div>
                            </div>
                            <h2 className="text-xl font-black text-slate-900">{rider.name}</h2>
                            <p className="text-sm font-bold text-slate-500 mt-1">Rider ID: RD-{rider._id.slice(-6).toUpperCase()}</p>

                            <div className="w-full h-px bg-slate-100 my-6" />

                            <div className="w-full space-y-4 text-left">
                                <InfoRow icon={Phone} label="Phone" value={rider.phone} />
                                <InfoRow icon={Mail} label="Email" value={rider.email} />
                                <InfoRow icon={Truck} label="Vehicle" value={`${rider.vehicleType || 'bike'} • ${rider.vehicleNumber || 'N/A'}`} />
                                <InfoRow icon={MapPin} label="Base Area" value={rider.currentArea || 'Unknown Area'} />
                                <InfoRow icon={MapPin} label="Permanent Address" value={rider.address} />
                                <InfoRow
                                    icon={rider.isVerified ? ShieldCheck : ShieldAlert}
                                    label="Verification Status"
                                    value={rider.isVerified ? 'KYC Verified' : 'Pending Verification'}
                                />
                                <InfoRow
                                    icon={Calendar}
                                    label="Joined On"
                                    value={rider.createdAt ? new Date(rider.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null}
                                />
                                <InfoRow
                                    icon={Clock}
                                    label="Last Login"
                                    value={rider.lastLogin ? new Date(rider.lastLogin).toLocaleString() : null}
                                />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white">
                        <h3 className="text-sm font-black text-slate-900 mb-5">KYC Details</h3>
                        <div className="space-y-4">
                            <InfoRow icon={IdCard} label="Aadhar Number" value={rider.aadharNumber} mono />
                            <InfoRow icon={FileText} label="PAN Number" value={rider.panNumber} mono />
                            <InfoRow icon={IdCard} label="Driving License Number" value={rider.drivingLicenseNumber} mono />
                        </div>
                    </Card>

                    <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white">
                        <h3 className="text-sm font-black text-slate-900 mb-5">Uploaded Documents</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <DocumentTile label="Aadhar Card" url={rider.documents?.aadhar} />
                            <DocumentTile label="Driving License" url={rider.documents?.drivingLicense} />
                            <DocumentTile label="RC Book" url={rider.documents?.pan} />
                            <DocumentTile label="Profile Photo" url={rider.documents?.profileImage} />
                        </div>
                    </Card>

                    <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white">
                        <h3 className="text-sm font-black text-slate-900 mb-5">Bank Details</h3>
                        <div className="space-y-4">
                            <InfoRow icon={Landmark} label="Account Holder" value={rider.accountHolder} />
                            <InfoRow icon={CreditCard} label="Account Number" value={rider.accountNumber} mono />
                            <InfoRow icon={Landmark} label="IFSC Code" value={rider.ifsc} mono />
                        </div>
                    </Card>

                    <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white">
                        <h3 className="text-sm font-black text-slate-900 mb-5">Activity Timeline</h3>
                        <div className="space-y-6">
                            {activityLogs && activityLogs.length > 0 ? (
                                activityLogs.slice(0, 10).map((log, index) => (
                                    <div key={log._id || index} className="flex items-start gap-4 relative">
                                        {index !== Math.min(activityLogs.length, 10) - 1 && (
                                            <div className="absolute top-8 left-4 bottom-[-24px] w-0.5 bg-slate-100" />
                                        )}
                                        <div className={cn(
                                            "h-8 w-8 rounded-lg flex items-center justify-center mt-1 z-10 ring-4 ring-white shrink-0",
                                            log.type === 'login' ? "bg-indigo-50 text-indigo-500" :
                                            log.type === 'logout' ? "bg-rose-50 text-rose-500" :
                                            log.type === 'online' ? "bg-emerald-50 text-emerald-500" :
                                            "bg-slate-100 text-slate-500"
                                        )}>
                                            {log.type === 'login' || log.type === 'logout' ? <Clock className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{log.type}</p>
                                            <p className="text-sm font-bold text-slate-900">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </p>
                                            {(log.area || (log.location && log.location.coordinates)) && (
                                                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                                    <GeocodedLocation log={log} />
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-xs font-bold text-slate-400">No recent activity logs.</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right Column: Stats & Order History */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Stats Grid — each card is a shortcut filter onto Recent Rides below */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { key: 'delivered', label: 'Total Deliveries', value: stats.totalOrders, icon: Package, color: 'blue' },
                            { key: 'all', label: 'Total Earnings', value: `₹${stats.totalEarnings}`, icon: DollarSign, color: 'emerald' },
                            { key: 'today', label: "Today's Earnings", value: `₹${stats.todayEarnings}`, icon: DollarSign, color: 'amber' },
                            { key: 'rated', label: 'Avg Rating', value: stats.rating, icon: Star, color: 'purple' },
                        ].map((s) => {
                            const isActiveFilter = rideFilter === s.key;
                            return (
                                <Card
                                    key={s.key}
                                    onClick={() => setRideFilter((prev) => (prev === s.key ? 'all' : s.key))}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setRideFilter((prev) => (prev === s.key ? 'all' : s.key));
                                        }
                                    }}
                                    className={cn(
                                        "p-5 border-none shadow-sm ring-1 bg-white group transition-all text-center cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]",
                                        isActiveFilter ? "ring-2 ring-primary/50" : "ring-slate-100 hover:ring-primary/20",
                                    )}
                                >
                                    <div className={cn(
                                        "mx-auto h-10 w-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform",
                                        s.color === 'blue' && "bg-blue-50 text-blue-500",
                                        s.color === 'emerald' && "bg-emerald-50 text-emerald-500",
                                        s.color === 'amber' && "bg-amber-50 text-amber-500",
                                        s.color === 'purple' && "bg-purple-50 text-purple-500",
                                    )}>
                                        <s.icon className={cn("h-5 w-5", s.key === 'rated' && "fill-current")} />
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                                    <p className="text-xl font-black text-slate-900 mt-1">{s.value}</p>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Order History List */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-sm font-black text-slate-900">
                                Recent Rides
                                {rideFilter !== 'all' && (
                                    <span className="ml-2 text-[10px] font-black text-primary uppercase tracking-widest">
                                        · {rideFilter === 'delivered' ? 'Delivered' : rideFilter === 'today' ? "Today's Deliveries" : 'Rated'}
                                    </span>
                                )}
                            </h3>
                            <div className="flex items-center gap-2">
                                {rideFilter !== 'all' && (
                                    <button
                                        type="button"
                                        onClick={() => setRideFilter('all')}
                                        className="text-[10px] font-black text-slate-400 hover:text-primary uppercase tracking-widest"
                                    >
                                        Clear filter
                                    </button>
                                )}
                                <Badge variant="neutral" className="text-[10px]">Last 50</Badge>
                            </div>
                        </div>
                        <div className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left whitespace-nowrap">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                            <th className="px-6 py-4">Order ID</th>
                                            <th className="px-6 py-4">Date & Time</th>
                                            <th className="px-6 py-4">Customer</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Delivery Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredOrders && filteredOrders.length > 0 ? (
                                            filteredOrders.map((order) => (
                                                <tr key={order._id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-bold text-indigo-600">
                                                            #{order.displayOrderNumber || order.orderId.slice(-8).toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-xs font-bold text-slate-900">
                                                            {new Date(order.createdAt).toLocaleDateString()}
                                                        </div>
                                                        <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                                            {new Date(order.createdAt).toLocaleTimeString()}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-xs font-bold text-slate-900">
                                                            {order.customer?.name || 'Guest'}
                                                        </div>
                                                        <div className="text-[10px] font-semibold text-slate-400 mt-0.5 max-w-[150px] truncate">
                                                            {order.address?.address || 'No address'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge
                                                            variant={order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'error' : 'warning'}
                                                            className="uppercase font-black text-[9px] px-2"
                                                        >
                                                            {order.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {order.deliveryRating ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-0.5 text-amber-500">
                                                                    {[1, 2, 3, 4, 5].map((s) => (
                                                                        <Star
                                                                            key={s}
                                                                            size={12}
                                                                            className={cn("fill-current", s <= order.deliveryRating ? "opacity-100" : "opacity-20")}
                                                                        />
                                                                    ))}
                                                                </div>
                                                                {order.deliveryFeedback && (
                                                                    <p className="text-[10px] font-medium text-slate-500 italic max-w-[180px] truncate" title={order.deliveryFeedback}>
                                                                        "{order.deliveryFeedback}"
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 font-semibold">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center">
                                                    <Package className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                                                    <p className="text-xs font-bold text-slate-500">
                                                        {rideFilter === 'all' ? 'No recent rides found.' : 'No rides match this filter.'}
                                                    </p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DeliveryPartnerProfile;
