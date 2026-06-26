import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import {
    ArrowLeft, User, Phone, MapPin, Truck, Star, DollarSign,
    ShieldCheck, Clock, Calendar, Activity, Package
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

const DeliveryPartnerProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [partnerData, setPartnerData] = useState(null);

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

    const { rider, stats, recentOrders, activityLogs } = partnerData;

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
                                <div className="h-28 w-28 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 shadow-inner">
                                    <User className="h-14 w-14" />
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
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                        <Phone className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</p>
                                        <p className="text-sm font-bold text-slate-900">{rider.phone}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                        <Truck className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle</p>
                                        <p className="text-sm font-bold text-slate-900 capitalize">{rider.vehicleType} • {rider.vehicleNumber || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                        <MapPin className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Area</p>
                                        <p className="text-sm font-bold text-slate-900">{rider.currentArea || 'Unknown Area'}</p>
                                    </div>
                                </div>
                            </div>
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
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all text-center">
                            <div className="mx-auto h-10 w-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Package className="h-5 w-5" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Deliveries</p>
                            <p className="text-xl font-black text-slate-900 mt-1">{stats.totalOrders}</p>
                        </Card>
                        <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all text-center">
                            <div className="mx-auto h-10 w-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <DollarSign className="h-5 w-5" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Earnings</p>
                            <p className="text-xl font-black text-slate-900 mt-1">₹{stats.totalEarnings}</p>
                        </Card>
                        <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all text-center">
                            <div className="mx-auto h-10 w-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <DollarSign className="h-5 w-5" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Earnings</p>
                            <p className="text-xl font-black text-slate-900 mt-1">₹{stats.todayEarnings}</p>
                        </Card>
                        <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all text-center">
                            <div className="mx-auto h-10 w-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Star className="h-5 w-5 fill-current" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Rating</p>
                            <p className="text-xl font-black text-slate-900 mt-1">{stats.rating}</p>
                        </Card>
                    </div>

                    {/* Order History List */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-sm font-black text-slate-900">Recent Rides</h3>
                            <Badge variant="neutral" className="text-[10px]">Last 50</Badge>
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
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {recentOrders && recentOrders.length > 0 ? (
                                            recentOrders.map((order) => (
                                                <tr key={order._id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-bold text-indigo-600">
                                                            #{order.orderId.slice(-8).toUpperCase()}
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
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center">
                                                    <Package className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                                                    <p className="text-xs font-bold text-slate-500">No recent rides found.</p>
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
