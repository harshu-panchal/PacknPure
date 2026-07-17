import React, { useState, useEffect } from 'react';
import { PackageSearch, Clock, MapPin, Store, CheckCircle, AlertTriangle } from 'lucide-react';
import axiosInstance from '@core/api/axios';
import { format } from 'date-fns';

export default function ProcurementStatus() {
    const [procurements, setProcurements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProcurements();
        const interval = setInterval(fetchProcurements, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchProcurements = async () => {
        try {
            const { data } = await axiosInstance.get('/admin/purchase-requests', {
                params: { source: 'POS_SHORTAGE' } // Try to get POS specific if supported, or just all
            });
            if (data.success) {
                // Filter to show active/pending ones recently triggered
                const activeRequests = (data.data || []).filter(req => 
                    ['pending', 'accepted', 'in_transit', 'assigned'].includes(req.status.toLowerCase())
                );
                setProcurements(activeRequests);
            }
        } catch (error) {
            console.error("Failed to fetch procurement status", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'ACCEPTED': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'IN_TRANSIT': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
            case 'RECEIVED': return 'bg-green-100 text-green-800 border-green-200';
            case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <PackageSearch className="mr-3 w-7 h-7 text-blue-600" />
                        Procurement Status
                    </h1>
                    <p className="text-gray-500 mt-1">Live tracking of vendor stock requests triggered by POS shortages</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                            <tr>
                                <th className="py-4 px-6 font-semibold">Request ID</th>
                                <th className="py-4 px-6 font-semibold">Product Details</th>
                                <th className="py-4 px-6 font-semibold text-center">Required Qty</th>
                                <th className="py-4 px-6 font-semibold">Seller Assignment</th>
                                <th className="py-4 px-6 font-semibold">Status / ETA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-8 text-gray-500">Loading procurement requests...</td>
                                </tr>
                            ) : procurements.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-8 text-gray-500">No active procurement requests found.</td>
                                </tr>
                            ) : (
                                procurements.map((req, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-4 px-6 font-medium text-gray-900">{req.requestId}</td>
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-gray-800">{req.product?.name || 'Unknown Product'}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{req.variant?.name || ''}</div>
                                            <div className="text-[10px] text-gray-400 mt-1">Generated: {format(new Date(req.createdAt), 'hh:mm a')}</div>
                                        </td>
                                        <td className="py-4 px-6 text-center font-bold text-gray-700">{req.requestedQty}</td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center text-sm font-medium text-gray-700">
                                                <Store className="w-4 h-4 mr-2 text-gray-400" />
                                                {req.assignedVendor?.businessName || 'Finding Seller...'}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col gap-2">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold w-fit border ${getStatusColor(req.status?.toUpperCase() || 'PENDING')}`}>
                                                    {req.status?.toUpperCase()}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}