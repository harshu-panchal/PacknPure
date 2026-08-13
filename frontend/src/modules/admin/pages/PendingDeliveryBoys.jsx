import React, { useState, useMemo } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    Search,
    Filter,
    CheckCircle,
    XCircle,
    FileSearch,
    Phone,
    Mail,
    Truck,
    MapPin,
    Calendar,
    IdCard,
    RotateCw,
    Check,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';

const PendingDeliveryBoys = () => {
    const [pendingRiders, setPendingRiders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [viewingRider, setViewingRider] = useState(null);
    const [previewDoc, setPreviewDoc] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Fetch Pending Riders
    const fetchPendingRiders = async () => {
        setIsLoading(true);
        try {
            // verified=false fetches riders waiting for review
            const response = await adminApi.getDeliveryPartners({ verified: 'false' });
            const payload = response.data.result || {};
            const list = Array.isArray(payload.items) ? payload.items : (response.data.results || []);

            // Map backend data to frontend format
            const mappedRiders = list.map(r => {
                const docsObj = r.documents || {};
                // profileImage is rendered separately as the rider's avatar, not a legal document
                const docEntries = Object.entries(docsObj).filter(
                    ([key, val]) => !!val && key !== 'profileImage',
                );
                
                return {
                    id: r._id,
                    name: r.name,
                    phone: r.phone,
                    email: r.email,
                    appliedDate: new Date(r.createdAt).toLocaleDateString(),
                    location: r.currentArea || r.address || 'Unknown',
                    vehicle: r.vehicleType || 'bike',
                    vehicleNumber: r.vehicleNumber || 'Not Provided',
                    aadharNumber: r.aadharNumber || 'Not Provided',
                    panNumber: r.panNumber || 'Not Provided',
                    drivingLicenseNumber: r.drivingLicenseNumber || 'Not Provided',
                    address: r.address || 'Not Provided',
                    bankDetails: {
                        accountHolder: r.accountHolder || 'Not Provided',
                        accountNumber: r.accountNumber || 'Not Provided',
                        ifsc: r.ifsc || 'Not Provided'
                    },
                    rawDocuments: docsObj,
                    documentsList: docEntries.map(([type, url]) => ({
                        type,
                        name: type.toUpperCase(),
                        url
                    })),
                    status: r.isVerified ? 'approved' : 'pending_review',
                    experience: 'Fresh Applicant',
                    preferredArea: r.currentArea || r.address || 'Not Specified'
                };
            });

            setPendingRiders(mappedRiders);
        } catch (error) {
            console.error('Fetch Pending Riders Error:', error);
            toast.error('Failed to load applications');
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchPendingRiders();
    }, []);

    const filteredRiders = useMemo(() => {
        return pendingRiders.filter(r => {
            const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.phone.includes(searchTerm);
            const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [pendingRiders, searchTerm, filterStatus]);

    const handleApprove = async (id) => {
        setIsProcessing(true);
        try {
            await adminApi.approveDeliveryPartner(id);
            toast.success('Rider Approved & Activated!');
            setPendingRiders(pendingRiders.filter(r => r.id !== id));
            setViewingRider(null);
        } catch (error) {
            console.error('Approval Error:', error);
            toast.error('Failed to approve rider');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (id) => {
        if (window.confirm('Are you sure you want to reject this application?')) {
            setIsProcessing(true);
            try {
                await adminApi.rejectDeliveryPartner(id);
                toast.success('Application Rejected');
                setPendingRiders(pendingRiders.filter(r => r.id !== id));
                setViewingRider(null);
            } catch (error) {
                console.error('Rejection Error:', error);
                toast.error('Failed to reject rider');
            } finally {
                setIsProcessing(false);
            }
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Rider Applications
                        <Badge variant="primary" className="text-[10px] px-2 py-0.5 uppercase">Pending Review</Badge>
                    </h1>
                    <p className="ds-description mt-1">Review documents and credentials for new delivery partners.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchPendingRiders} className="p-3 bg-white ring-1 ring-slate-200 rounded-2xl text-slate-400 hover:text-primary transition-all shadow-sm active:rotate-180 duration-500">
                        <RotateCw className="h-5 w-5" />
                    </button>
                    <div className="h-10 w-[1px] bg-slate-200 mx-2" />
                    <div className="flex flex-col items-end">
                        <p className="ds-label">Total Pending</p>
                        <h4 className="ds-h2">{pendingRiders.length}</h4>
                    </div>
                </div>
            </div>

            {/* Utility Bar */}
            <Card className="p-4 border-none shadow-sm ring-1 ring-slate-100 bg-white/50 backdrop-blur-xl">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name or mobile..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-100/50 border-none rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100/50 p-1 rounded-2xl flex items-center">
                            {['all', 'pending', 'missing_info'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                        filterStatus === status
                                            ? "bg-white text-slate-900 shadow-sm"
                                            : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {status === 'pending' ? 'PENDING' : status.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                        <button className="p-3.5 bg-white ring-1 ring-slate-200 rounded-2xl text-slate-600 hover:text-primary transition-all">
                            <Filter className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </Card>

            {/* Applications Table View */}
            <Card className="border-none shadow-2xl ring-1 ring-slate-100 overflow-hidden bg-white rounded-xl relative min-h-[400px]">
                {isLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-10 w-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Applications...</p>
                        </div>
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="ds-table-header-cell px-6 py-4">Applicant Details</th>
                                <th className="ds-table-header-cell px-6 py-4">Vehicle & Location</th>
                                <th className="ds-table-header-cell px-6 py-4">Submitted Docs</th>
                                <th className="ds-table-header-cell px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {!isLoading && filteredRiders.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-20 text-center">
                                        <FileSearch className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                                        <p className="text-sm font-bold text-slate-500">No pending applications found.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredRiders.map((rider) => (
                                    <tr key={rider.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary transition-all flex-shrink-0">
                                                    {rider.rawDocuments?.profileImage ? (
                                                        <img
                                                            src={rider.rawDocuments.profileImage}
                                                            alt={rider.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <IdCard className="h-6 w-6" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{rider.name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Phone className="h-3 w-3 text-slate-400" />
                                                        <span className="text-[11px] font-bold text-slate-500">{rider.phone}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <Truck className="h-3.5 w-3.5 text-emerald-600" />
                                                    <span className="text-xs font-bold capitalize">{rider.vehicle} ({rider.vehicleNumber})</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <MapPin className="h-3.5 w-3.5" />
                                                    <span className="text-[11px] font-bold truncate max-w-[200px]">{rider.location}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1.5">
                                                <Badge variant={rider.status === 'pending_review' ? 'primary' : 'warning'} className="w-fit text-[8px] font-black uppercase">
                                                    {rider.status.replace('_', ' ')}
                                                </Badge>
                                                <div className="flex flex-wrap gap-1">
                                                    {rider.documentsList.length > 0 ? (
                                                        rider.documentsList.map((doc, i) => (
                                                            <span key={i} className="h-5 px-2 bg-slate-100 rounded-md text-[9px] font-bold text-slate-600 flex items-center gap-1">
                                                                <Check className="h-2.5 w-2.5 text-emerald-500" />
                                                                {doc.name}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 italic">No files attached</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button
                                                onClick={() => setViewingRider(rider)}
                                                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black tracking-wider uppercase shadow-lg hover:bg-primary transition-all active:scale-95"
                                            >
                                                REVIEW APPLICATION
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Application Review Modal */}
            <AnimatePresence>
                {viewingRider && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
                            onClick={() => setViewingRider(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-5xl relative z-10 bg-white rounded-3xl md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col lg:flex-row my-auto max-h-[92vh]"
                        >
                            {/* Left: Applicant Profile Side Banner */}
                            <div className="lg:w-80 bg-slate-900 text-white p-6 md:p-8 flex flex-col justify-between overflow-y-auto flex-shrink-0">
                                <div>
                                    <div className="flex justify-between items-center lg:hidden mb-4">
                                        <Badge variant="primary" className="text-[10px]">VERIFICATION PROTOCOL</Badge>
                                        <button onClick={() => setViewingRider(null)} className="p-2 text-slate-400 hover:text-white">
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>
                                    <div className="text-center my-4">
                                        <div className="h-24 w-24 rounded-3xl bg-slate-800 border-2 border-slate-700 shadow-2xl flex items-center justify-center text-primary mx-auto mb-4 relative overflow-hidden group">
                                            {viewingRider.rawDocuments.profileImage ? (
                                                <img 
                                                    src={viewingRider.rawDocuments.profileImage} 
                                                    alt={viewingRider.name} 
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <IdCard className="h-12 w-12" />
                                            )}
                                        </div>
                                        <h3 className="text-xl font-black tracking-tight">{viewingRider.name}</h3>
                                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">Delivery Partner Applicant</p>
                                    </div>

                                    <div className="space-y-4 mt-8 pt-6 border-t border-slate-800">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Applied Date</p>
                                            <p className="text-xs font-bold text-slate-200 mt-0.5">{viewingRider.appliedDate}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Preferred Operating Area</p>
                                            <div className="flex items-center gap-2 text-slate-200 mt-1">
                                                <MapPin className="h-4 w-4 text-primary shrink-0" />
                                                <span className="text-xs font-bold leading-tight">{viewingRider.preferredArea}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Address</p>
                                            <p className="text-xs font-semibold text-slate-300 mt-0.5 leading-relaxed">{viewingRider.address}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 mt-8 border-t border-slate-800">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Match Score</p>
                                        <span className="text-xs font-black text-emerald-400">100% Verified</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 w-full" />
                                    </div>
                                </div>
                            </div>

                            {/* Right: Full Vetting Details & Action Panel */}
                            <div className="flex-1 p-6 md:p-10 bg-white overflow-y-auto">
                                <div className="hidden lg:flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Vetting Protocol</h2>
                                        <p className="text-xs font-semibold text-slate-400 mt-1">Inspect identity documents, vehicle credentials & bank records.</p>
                                    </div>
                                    <button onClick={() => setViewingRider(null)} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
                                        <X className="h-5 w-5 text-slate-500" />
                                    </button>
                                </div>

                                {/* Credentials Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                    {/* Contact Records */}
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Phone className="h-3.5 w-3.5 text-primary" />
                                            Contact Records
                                        </h4>
                                        <div className="space-y-2 pt-1">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400">Phone Number</p>
                                                <p className="text-sm font-black text-slate-900">{viewingRider.phone}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400">Email Address</p>
                                                <p className="text-xs font-bold text-slate-700 truncate">{viewingRider.email}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Vehicle Identification */}
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Truck className="h-3.5 w-3.5 text-emerald-600" />
                                            Vehicle Identification
                                        </h4>
                                        <div className="space-y-2 pt-1">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400">Vehicle Type</p>
                                                <p className="text-sm font-black text-slate-900 capitalize">{viewingRider.vehicle}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400">Vehicle Registration No.</p>
                                                <p className="text-xs font-black text-emerald-700 bg-emerald-50 w-fit px-2 py-0.5 rounded-md">{viewingRider.vehicleNumber}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Government Identification */}
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <IdCard className="h-3.5 w-3.5 text-indigo-600" />
                                            Government IDs
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400">Aadhar No.</p>
                                                <p className="text-xs font-black text-slate-900">{viewingRider.aadharNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400">PAN No.</p>
                                                <p className="text-xs font-black text-slate-900">{viewingRider.panNumber}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[10px] font-bold text-slate-400">Driving License No.</p>
                                                <p className="text-xs font-black text-slate-900">{viewingRider.drivingLicenseNumber}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bank Account Records */}
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <CheckCircle className="h-3.5 w-3.5 text-amber-500" />
                                            Payout Bank Account
                                        </h4>
                                        <div className="space-y-1.5 pt-1">
                                            <div className="flex justify-between">
                                                <span className="text-[10px] font-bold text-slate-400">Holder:</span>
                                                <span className="text-xs font-bold text-slate-900">{viewingRider.bankDetails.accountHolder}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-[10px] font-bold text-slate-400">Account No:</span>
                                                <span className="text-xs font-bold text-slate-900">{viewingRider.bankDetails.accountNumber}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-[10px] font-bold text-slate-400">IFSC Code:</span>
                                                <span className="text-xs font-bold text-slate-900">{viewingRider.bankDetails.ifsc}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Submitted Documents Section */}
                                <div className="space-y-4 mb-8">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Uploaded Legal Proof Documents ({viewingRider.documentsList.length})
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-400 italic">Click card to preview document</span>
                                    </div>
                                    
                                    {viewingRider.documentsList.length === 0 ? (
                                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                            <FileSearch className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-xs font-bold text-slate-500">No document files attached by applicant.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {viewingRider.documentsList.map((doc, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => setPreviewDoc(doc)}
                                                    className="group relative bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-primary p-3 transition-all cursor-pointer flex flex-col justify-between h-40 shadow-sm hover:shadow-md"
                                                >
                                                    {doc.url ? (
                                                        <div className="h-24 w-full bg-slate-200 rounded-xl overflow-hidden relative">
                                                            <img
                                                                src={doc.url}
                                                                alt={doc.name}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                }}
                                                            />
                                                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-[10px] font-bold">
                                                                <span>Click to View</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="h-24 w-full bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                                            <FileSearch className="h-8 w-8" />
                                                        </div>
                                                    )}
                                                    
                                                    <div className="mt-2 flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-slate-800 uppercase">{doc.name}</span>
                                                        <span className="text-[9px] font-bold text-primary flex items-center gap-0.5">
                                                            VIEW <Check className="h-3 w-3" />
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-100">
                                    <button
                                        disabled={isProcessing}
                                        onClick={() => handleApprove(viewingRider.id)}
                                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                Activating Rider...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4.5 w-4.5" />
                                                APPROVE & ACTIVATE RIDER
                                            </>
                                        )}
                                    </button>
                                    <button
                                        disabled={isProcessing}
                                        onClick={() => handleReject(viewingRider.id)}
                                        className="py-4 px-6 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <XCircle className="h-4.5 w-4.5" />
                                        REJECT APPLICATION
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Document Preview Lightbox Modal */}
            <AnimatePresence>
                {previewDoc && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl"
                            onClick={() => setPreviewDoc(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative z-10 max-w-4xl w-full bg-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                                <h3 className="text-base font-black text-slate-900 uppercase">
                                    Document Proof: {previewDoc.name}
                                </h3>
                                <div className="flex items-center gap-2">
                                    {previewDoc.url && (
                                        <a
                                            href={previewDoc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                                        >
                                            Open Original
                                        </a>
                                    )}
                                    <button
                                        onClick={() => setPreviewDoc(null)}
                                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-100 rounded-2xl p-4 min-h-[300px]">
                                {previewDoc.url ? (
                                    <img
                                        src={previewDoc.url}
                                        alt={previewDoc.name}
                                        className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg"
                                    />
                                ) : (
                                    <div className="text-center py-12">
                                        <FileSearch className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-slate-600">No Image URL Available</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PendingDeliveryBoys;
