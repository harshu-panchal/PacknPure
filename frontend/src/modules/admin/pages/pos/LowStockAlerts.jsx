import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, ArrowRight } from 'lucide-react';
import axiosInstance from '@core/api/axios';

export default function LowStockAlerts() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLowStock();
    }, []);

    const fetchLowStock = async () => {
        try {
            // Using the main hub inventory endpoint to get full visibility
            // We'll filter for low stock items client-side for this demo, 
            // but ideally we'd pass a query param like ?stockStatus=low
            const { data } = await axiosInstance.get('/admin/hub-inventory', {
                params: { limit: 100 }
            });
            if (data.success) {
                const lowStockItems = (data.results || data.data || []).filter(item => {
                    const qty = item.availableQty || 0;
                    return qty > 0 && qty <= 5;
                });
                setAlerts(lowStockItems);
            }
        } catch (error) {
            console.error("Failed to fetch low stock alerts", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <AlertTriangle className="mr-3 w-7 h-7 text-red-600" />
                        Low Stock Alerts
                    </h1>
                    <p className="text-gray-500 mt-1">Items at risk of stockouts during POS checkout</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-red-50 flex items-center text-red-800">
                    <TrendingDown className="w-5 h-5 mr-2" />
                    <strong>{alerts.length} Items</strong> &nbsp;require immediate procurement attention.
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                            <tr>
                                <th className="py-4 px-6 font-semibold">Product Name</th>
                                <th className="py-4 px-6 font-semibold">SKU / Variant</th>
                                <th className="py-4 px-6 font-semibold text-center">Hub Available</th>
                                <th className="py-4 px-6 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="text-center py-8 text-gray-500">Scanning inventory...</td>
                                </tr>
                            ) : alerts.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="text-center py-12 text-gray-500">
                                        <AlertTriangle className="w-12 h-12 mx-auto text-green-300 mb-3" />
                                        <div className="font-medium text-gray-900">Inventory is healthy</div>
                                        <div className="text-sm mt-1">No low stock items detected in Hub.</div>
                                    </td>
                                </tr>
                            ) : (
                                alerts.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-red-50 transition-colors">
                                        <td className="py-4 px-6 font-medium text-gray-900">{item.name}</td>
                                        <td className="py-4 px-6 text-gray-600">
                                            {item.sku || 'N/A'} {item.variantName ? `(${item.variantName})` : ''}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="inline-flex items-center justify-center bg-red-100 text-red-800 font-bold px-3 py-1 rounded-full text-sm">
                                                {item.availableQty}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <button className="text-indigo-600 font-semibold hover:text-indigo-800 flex items-center justify-end w-full">
                                                Request Stock <ArrowRight className="w-4 h-4 ml-1" />
                                            </button>
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