import React, { useState, useEffect } from 'react';
import { PackageSearch, Clock, MapPin, Store, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ProcurementStatus() {
    const [procurements, setProcurements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mock data for Procurement Status
        setTimeout(() => {
            setProcurements([
                {
                    _id: 'PRQ-901',
                    productName: 'Aashirvaad Shudh Chakki Atta',
                    variantName: '10kg',
                    requiredQty: 25,
                    status: 'PENDING',
                    sellerAssigned: 'SuperMart Wholesale',
                    eta: '2 Hours',
                    orderId: 'POS173000123'
                },
                {
                    _id: 'PRQ-902',
                    productName: 'Amul Taaza Milk',
                    variantName: '1L',
                    requiredQty: 10,
                    status: 'ACCEPTED',
                    sellerAssigned: 'FreshDairy Distributor',
                    eta: '30 Mins',
                    orderId: 'POS173000456'
                }
            ]);
            setLoading(false);
        }, 1000);
    }, []);

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
                                        <td className="py-4 px-6 font-medium text-gray-900">{req._id}</td>
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-gray-800">{req.productName}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{req.variantName}</div>
                                            <div className="text-[10px] text-gray-400 mt-1">Triggered by: {req.orderId}</div>
                                        </td>
                                        <td className="py-4 px-6 text-center font-bold text-gray-700">{req.requiredQty}</td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center text-sm font-medium text-gray-700">
                                                <Store className="w-4 h-4 mr-2 text-gray-400" />
                                                {req.sellerAssigned}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col gap-2">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold w-fit border ${getStatusColor(req.status)}`}>
                                                    {req.status}
                                                </span>
                                                <div className="flex items-center text-xs text-gray-500 font-medium">
                                                    <Clock className="w-3.5 h-3.5 mr-1" /> ETA: {req.eta}
                                                </div>
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