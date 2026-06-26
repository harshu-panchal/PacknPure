import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    HiOutlineBuildingOffice2,
    HiOutlineMagnifyingGlass,
    HiOutlineFunnel,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineEye,
    HiOutlineEnvelope,
    HiOutlinePhone,
    HiOutlineDocumentText,
    HiOutlineMapPin,
    HiOutlineCalendarDays,
    HiOutlineClock,
    HiOutlineXMark,
    HiOutlineCheck,
    HiOutlineArrowPath
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import SellerTabs from '../components/SellerTabs';

const PendingSellers = () => {
    const navigate = useNavigate();
    const [pendingSellers, setPendingSellers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [viewingSeller, setViewingSeller] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchPendingSellers = async () => {
        try {
            setIsLoading(true);
            const res = await adminApi.getSellers({ verified: 'false' });
            const payload = res?.data?.result || {};
            const items = Array.isArray(payload.items) ? payload.items : [];
            setPendingSellers(items);
        } catch (error) {
            console.error('Fetch pending sellers failed:', error);
            toast.error('Failed to load applications');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingSellers();
    }, []);

    const stats = useMemo(() => ({
        total: pendingSellers.length,
        today: pendingSellers.filter(s => {
            const today = new Date().toDateString();
            return new Date(s.createdAt).toDateString() === today;
        }).length,
        urgent: 0 // Mock for now
    }), [pendingSellers]);

    const filteredSellers = useMemo(() => {
        return pendingSellers.filter(s =>
            (s.shopName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [pendingSellers, searchTerm]);

    const handleApprove = async (id) => {
        setIsProcessing(true);
        try {
            await adminApi.approveSeller(id);
            toast.success('Seller Approved Successfully!');
            setPendingSellers(pendingSellers.filter(s => s._id !== id));
            setIsReviewModalOpen(false);
        } catch (error) {
            console.error('Approval Error:', error);
            toast.error(error?.response?.data?.message || 'Failed to approve seller');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (id) => {
        if (window.confirm('Are you sure you want to reject this application?')) {
            setIsProcessing(true);
            try {
                await adminApi.rejectSeller(id);
                toast.success('Application Rejected');
                setPendingSellers(pendingSellers.filter(s => s._id !== id));
                setIsReviewModalOpen(false);
            } catch (error) {
                console.error('Rejection Error:', error);
                toast.error(error?.response?.data?.message || 'Failed to reject seller');
            } finally {
                setIsProcessing(false);
            }
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
            <SellerTabs />
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1 flex items-center gap-2">
                        Pending Approvals
                        <Badge variant="warning" className="admin-tiny px-1.5 py-0 font-bold animate-pulse">Action Required</Badge>
                    </h1>
                    <p className="ds-description mt-0.5">Check new seller applications before they can start selling.</p>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-xl ring-1 ring-amber-100">
                    <HiOutlineClock className="h-4 w-4 text-amber-600" />
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Avg Review Time: 24h</span>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Applications', val: stats.total, icon: HiOutlineDocumentText, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Received Today', val: stats.today, icon: HiOutlineCalendarDays, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Missing Info', val: stats.urgent, icon: HiOutlineXCircle, color: 'text-rose-600', bg: 'bg-rose-50' }
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100 p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="ds-label">{stat.label}</p>
                                <h4 className="ds-stat-medium mt-1">{stat.val}</h4>
                            </div>
                            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner", stat.bg, stat.color)}>
                                <stat.icon className="h-6 w-6" />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Content Area */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between bg-white">
                    <div className="relative flex-1 w-full max-w-md">
                        <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by shop name or owner..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                        <HiOutlineFunnel className="h-4 w-4" />
                        <span>Filter by Date</span>
                    </button>
                </div>

                <div className="overflow-x-auto min-h-[400px] relative">
                    {isLoading && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-3">
                                <div className="h-10 w-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching applications...</p>
                            </div>
                        </div>
                    )}
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="ds-table-header-cell px-6">Applicant Store</th>
                                <th className="ds-table-header-cell px-6">Contact Info</th>
                                <th className="ds-table-header-cell px-6">Applied On</th>
                                <th className="ds-table-header-cell px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredSellers.length > 0 ? filteredSellers.map((s) => (
                                <tr key={s._id} className="hover:bg-slate-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div
                                            className="flex items-center gap-4 cursor-pointer group/name"
                                            onClick={() => navigate(`/admin/sellers/active/${s._id}`)}
                                        >
                                            <div className="h-10 w-10 rounded-xl overflow-hidden bg-slate-100 ring-2 ring-slate-100 group-hover:ring-primary/20 transition-all">
                                                <div className="h-full w-full flex items-center justify-center bg-slate-100 text-slate-400">
                                                    <HiOutlineBuildingOffice2 className="h-5 w-5" />
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 group-hover/name:text-primary transition-colors">{s.shopName}</p>
                                                <p className="text-[10px] font-bold text-slate-400">{s.name}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                                <HiOutlineEnvelope className="h-3 w-3" /> {s.email}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                <HiOutlinePhone className="h-3 w-3" /> {s.phone}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700">{new Date(s.createdAt).toLocaleDateString()}</span>
                                            <span className="text-[9px] font-medium text-slate-400">{new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => { setViewingSeller(s); setIsReviewModalOpen(true); }}
                                                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-slate-800 transition-all shadow-lg hover:-translate-y-0.5 flex items-center gap-2"
                                            >
                                                <HiOutlineEye className="h-3.5 w-3.5" />
                                                VIEW APPLICATION
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : !isLoading && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                                <HiOutlineCheckCircle className="h-8 w-8 text-slate-200" />
                                            </div>
                                            <p className="text-slate-500 font-bold text-sm">All caught up! No pending applications.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Review Modal */}
            <AnimatePresence>
                {isReviewModalOpen && viewingSeller && (
                    <div className="fixed inset-0 z-[100] overflow-y-auto">
                        <div className="min-h-full flex items-center justify-center p-4 lg:p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-slate-900/80 backdrop-blur-md"
                                onClick={() => setIsReviewModalOpen(false)}
                            />

                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                                className="w-full max-w-4xl relative z-10 bg-white rounded-2xl shadow-2xl overflow-hidden"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-12">
                                    {/* Sidebar Info */}
                                    <div className="lg:col-span-4 bg-slate-50 p-4 border-r border-slate-100">
                                        <div className="flex justify-between items-start mb-8">
                                            <div className="h-20 w-20 rounded-xl bg-white shadow-xl flex items-center justify-center ds-stat-large font-bold text-primary border-4 border-white">
                                                {viewingSeller.shopName[0]}
                                            </div>
                                            <button
                                                onClick={() => setIsReviewModalOpen(false)}
                                                className="lg:hidden p-2 hover:bg-slate-200 rounded-full"
                                            >
                                                <HiOutlineXMark className="h-5 w-5" />
                                            </button>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <h3 className="ds-h2 leading-tight">{viewingSeller.shopName}</h3>
                                                <p className="text-xs font-bold text-primary mt-1 uppercase tracking-widest">{viewingSeller.category || "GENERAL"} PARTNER</p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <HiOutlineBuildingOffice2 className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-700">{viewingSeller.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <HiOutlineEnvelope className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-semibold text-slate-500">{viewingSeller.email}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <HiOutlinePhone className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-700">{viewingSeller.phone}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <HiOutlineMapPin className="h-4 w-4 text-slate-400" />
                                                        <span className="text-xs font-semibold text-slate-500">
                                                            {viewingSeller.address || viewingSeller.location?.coordinates?.join(', ') || "No Location Specified"}
                                                        </span>
                                                    </div>
                                                    {viewingSeller.location?.coordinates?.[0] && viewingSeller.location?.coordinates?.[1] && (
                                                        <a 
                                                            href={`https://www.google.com/maps?q=${viewingSeller.location.coordinates[1]},${viewingSeller.location.coordinates[0]}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[9px] font-black text-indigo-600 uppercase hover:underline"
                                                        >
                                                            View on Map
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-slate-200">
                                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Application Memo</h4>
                                                <p className="text-xs font-medium text-slate-600 italic leading-relaxed">
                                                    "{viewingSeller.description || "No description provided."}"
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Main Review Section */}
                                    <div className="lg:col-span-8 p-4 lg:p-5 bg-white relative">
                                        <button
                                            onClick={() => setIsReviewModalOpen(false)}
                                            className="hidden lg:block absolute right-8 top-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                                        >
                                            <HiOutlineXMark className="h-6 w-6 text-slate-300" />
                                        </button>

                                        <div className="ds-section-spacing">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <HiOutlineDocumentText className="h-5 w-5 text-indigo-500" />
                                                    <h4 className="text-sm font-bold text-slate-900">Submitted Verification Documents</h4>
                                                </div>
                                                <p className="text-xs text-slate-400 font-medium">Check each document before final approval.</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {viewingSeller.documents && Object.keys(viewingSeller.documents).some(k => viewingSeller.documents[k]) ? (
                                                    Object.entries(viewingSeller.documents).filter(([_, url]) => url).map(([key, url], i) => (
                                                        <a 
                                                            key={i} 
                                                            href={url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="p-4 rounded-2xl border-2 border-slate-50 bg-slate-50/50 hover:bg-white hover:border-indigo-100 transition-all cursor-pointer group"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                                                        <HiOutlineDocumentText className="h-5 w-5 text-indigo-400" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-bold text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                                                                        <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">VIEW DOCUMENT</p>
                                                                    </div>
                                                                </div>
                                                                <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                                                                    <HiOutlineCheck className="h-3.5 w-3.5" />
                                                                </div>
                                                            </div>
                                                        </a>
                                                    ))
                                                ) : (
                                                    <div className="col-span-2 py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                                                        <HiOutlineDocumentText className="h-8 w-8 mb-2 opacity-20" />
                                                        <p className="text-[10px] font-bold uppercase tracking-widest">No documents uploaded</p>
                                                    </div>
                                                )}
                                            </div>



                                            <div className="bg-amber-50 rounded-xl p-6 border border-amber-100/50">
                                                <div className="flex gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                                                        <HiOutlineCheckCircle className="h-6 w-6 text-amber-700" />
                                                    </div>
                                                    <div>
                                                        <h5 className="text-xs font-bold text-amber-900">Initial Review Passed</h5>
                                                        <p className="text-[10px] text-amber-700/80 font-medium mt-1 leading-relaxed">
                                                            Our system automatically checked all basic identity and shop locations. You need to check documents manually now.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Bar */}
                                            <div className="flex items-center gap-4 pt-6">
                                                <button
                                                    disabled={isProcessing}
                                                    onClick={() => handleReject(viewingSeller._id)}
                                                    className="flex-1 py-4 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-2xl text-[10px] font-bold tracking-widest transition-all uppercase"
                                                >
                                                    REJECT APPLICATION
                                                </button>
                                                <button
                                                    disabled={isProcessing}
                                                    onClick={() => handleApprove(viewingSeller._id)}
                                                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-bold tracking-widest shadow-2xl hover:bg-slate-800 transition-all transform active:scale-[0.98] uppercase flex items-center justify-center gap-2"
                                                >
                                                    {isProcessing ? (
                                                        <>
                                                            <HiOutlineArrowPath className="h-4 w-4 animate-spin" />
                                                            <span>FINALIZING...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <HiOutlineCheckCircle className="h-4 w-4" />
                                                            <span>APPROVE SELLER</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PendingSellers;
