import React, { useState, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import { useToast } from '@shared/components/ui/Toast';
import { HiOutlineMagnifyingGlass, HiOutlineFunnel, HiOutlineUser } from 'react-icons/hi2';
import { Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const ProductRequestsList = () => {
    const { showToast } = useToast();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    
    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [total, setTotal] = useState(0);

    const statuses = ['All', 'Pending', 'Reviewed', 'Approved', 'Rejected'];

    useEffect(() => {
        fetchRequests(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, pageSize]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchRequests(1);
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    const fetchRequests = async (requestedPage = 1) => {
        try {
            setLoading(true);
            const params = {
                page: requestedPage,
                limit: pageSize,
                search: searchTerm,
                status: statusFilter !== 'All' ? statusFilter : undefined
            };
            const res = await adminApi.getProductRequests(params);
            if (res.data.success) {
                setRequests(res.data.result?.items || []);
                setTotal(res.data.result?.total || 0);
                setPage(res.data.result?.page || requestedPage);
            }
        } catch (error) {
            console.error("Fetch Product Requests Error:", error);
            showToast("Failed to load product requests", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            const res = await adminApi.updateProductRequestStatus(id, newStatus);
            if (res.data.success) {
                showToast(`Status updated to ${newStatus}`, "success");
                setRequests(prev => prev.map(req => req._id === id ? { ...req, status: newStatus } : req));
            }
        } catch (error) {
            showToast("Failed to update status", "error");
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Pending': return 'warning';
            case 'Reviewed': return 'blue';
            case 'Approved': return 'success';
            case 'Rejected': return 'danger';
            default: return 'secondary';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Product Requests</h1>
                    <p className="text-sm font-bold text-slate-500 mt-1">Manage user product requests</p>
                </div>
            </div>

            <Card className="border-none shadow-xl ring-1 ring-slate-100 rounded-2xl overflow-hidden bg-white">
                {/* Filters & Search */}
                <div className="p-6 border-b border-slate-50 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto scrollbar-hide">
                            {statuses.map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap",
                                        statusFilter === status
                                            ? "bg-slate-900 text-white shadow-md"
                                            : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>

                        <div className="relative group w-full sm:w-72">
                            <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none ring-1 ring-transparent focus:ring-primary/10 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Product Info</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Customer</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Date</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-slate-300 mx-auto" />
                                    </td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center">
                                        <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <Package className="h-8 w-8 text-slate-300" />
                                        </div>
                                        <h3 className="text-sm font-black text-slate-900 mb-1">No requests found</h3>
                                        <p className="text-xs font-bold text-slate-400">Try adjusting your search or filters.</p>
                                    </td>
                                </tr>
                            ) : (
                                requests.map((req) => (
                                    <tr key={req._id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-4">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-900">{req.productName}</h4>
                                                {req.description && (
                                                    <p className="text-xs text-slate-500 font-medium mt-1 line-clamp-1 max-w-xs">{req.description}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                                    <HiOutlineUser className="h-4 w-4 text-slate-500" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900">{req.customer?.name || 'Unknown'}</p>
                                                    <p className="text-[10px] font-bold text-slate-400">{req.customer?.phone}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <p className="text-xs font-bold text-slate-600">
                                                {new Date(req.createdAt).toLocaleDateString('en-IN', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400">
                                                {new Date(req.createdAt).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </p>
                                        </td>
                                        <td className="p-4">
                                            <Badge variant={getStatusColor(req.status)} className="text-[10px] font-black uppercase tracking-widest">
                                                {req.status}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-right">
                                            <select
                                                value={req.status}
                                                onChange={(e) => handleStatusChange(req._id, e.target.value)}
                                                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg focus:ring-primary focus:border-primary block p-2 inline-block w-auto outline-none transition-all cursor-pointer hover:bg-slate-100"
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Reviewed">Reviewed</option>
                                                <option value="Approved">Approved</option>
                                                <option value="Rejected">Rejected</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-50">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                        loading={loading}
                    />
                </div>
            </Card>
        </div>
    );
};

export default ProductRequestsList;
