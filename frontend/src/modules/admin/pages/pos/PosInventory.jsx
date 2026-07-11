import React, { useState, useEffect } from 'react';
import { Boxes, Search, AlertTriangle, Store, PackageSearch } from 'lucide-react';
import axiosInstance from '@core/api/axios';

export default function PosInventory() {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchInventory();
    }, [search]);

    const fetchInventory = async () => {
        try {
            // Using the main hub inventory endpoint to get full visibility
            const { data } = await axiosInstance.get('/admin/hub-inventory', {
                params: { search, limit: 50 }
            });
            if (data.success) {
                setInventory(data.results || data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch inventory", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Boxes className="mr-3 w-7 h-7 text-indigo-600" />
                        POS Inventory Visibility
                    </h1>
                    <p className="text-gray-500 mt-1">Live Hub Stock, Reserved Quantities, and Seller Availability</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search by SKU, Name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-600 text-sm">
                            <tr>
                                <th className="py-3 px-4 font-semibold">Product</th>
                                <th className="py-3 px-4 font-semibold">Hub Available</th>
                                <th className="py-3 px-4 font-semibold">Hub Reserved</th>
                                <th className="py-3 px-4 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="text-center py-8 text-gray-500">Loading inventory...</td>
                                </tr>
                            ) : inventory.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="text-center py-8 text-gray-500">No products found.</td>
                                </tr>
                            ) : (
                                inventory.map((item, idx) => {
                                    const available = item.availableQty || 0;
                                    const reserved = item.reservedQty || 0;
                                    
                                    let statusNode;
                                    if (available === 0) {
                                        statusNode = <span className="flex items-center text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100 text-xs font-bold w-fit"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> OUT OF STOCK</span>;
                                    } else if (available <= 5) {
                                        statusNode = <span className="flex items-center text-orange-600 bg-orange-50 px-2 py-1 rounded-md border border-orange-100 text-xs font-bold w-fit"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> LOW STOCK</span>;
                                    } else {
                                        statusNode = <span className="text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-100 text-xs font-bold w-fit">IN STOCK</span>;
                                    }

                                    return (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-gray-900">{item.name}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">SKU: {item.sku || 'N/A'} {item.variantName ? ` | ${item.variantName}` : ''}</div>
                                            </td>
                                            <td className="py-3 px-4 font-bold text-gray-800">{available}</td>
                                            <td className="py-3 px-4 text-gray-600">{reserved}</td>
                                            <td className="py-3 px-4">{statusNode}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}