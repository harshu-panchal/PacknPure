import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { posApi } from '../../services/posApi';
import { Package, Clock, Truck, CheckCircle2, AlertTriangle, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@mui/material';

export default function CurrentOrders() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
        // Poll every 30 seconds for live updates
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchOrders = async () => {
        try {
            const { data } = await posApi.getOrders();
            if (data.success) {
                setOrders(data.results || data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch POS orders", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
            case 'voided': 
            case 'refunded': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getWorkflowColor = (status) => {
        switch (status) {
            case 'PENDING': return 'text-yellow-600 bg-yellow-50';
            case 'PROCUREMENT': return 'text-orange-600 bg-orange-50';
            case 'PACKED': return 'text-indigo-600 bg-indigo-50';
            case 'ASSIGNED': return 'text-blue-600 bg-blue-50';
            case 'DELIVERED': return 'text-green-600 bg-green-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    if (loading) {
        return <div className="p-6 text-center text-gray-500">Loading POS orders...</div>;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Package className="mr-3 w-7 h-7 text-blue-600" />
                        Current POS Orders
                    </h1>
                    <p className="text-gray-500 mt-1">Live tracking of Walk-in and Take-Away orders</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map((order) => (
                    <div key={order._id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className="font-bold text-gray-900 text-lg">#{order.orderId}</span>
                                <div className="text-sm text-gray-500 flex items-center mt-1">
                                    <Clock className="w-3.5 h-3.5 mr-1" />
                                    {format(new Date(order.createdAt), 'hh:mm a')}
                                </div>
                            </div>
                            <span className={`px-2.5 py-1 text-xs font-bold rounded border uppercase tracking-wider ${getStatusColor(order.status)}`}>
                                {order.status}
                            </span>
                        </div>

                        <div className="mb-4">
                            <div className="text-sm font-medium text-gray-700 mb-1">
                                {order.guestCustomer?.name || 'Walk-in Customer'}
                            </div>
                            {order.guestCustomer?.phone && (
                                <div className="text-xs text-gray-500">{order.guestCustomer.phone}</div>
                            )}
                            {order.address?.street && (
                                <div className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                                    <Truck className="w-3 h-3 mt-0.5" />
                                    {order.address.street}
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3 mb-4">
                            <div className="flex justify-between text-sm mb-2 pb-2 border-b border-gray-200">
                                <span className="text-gray-600">Items:</span>
                                <span className="font-bold text-gray-900">{order.items?.length || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold">
                                <span>Total:</span>
                                <span className="text-blue-700">₹{order.pricing?.total || 0}</span>
                            </div>
                        </div>

                        {/* Workflow Tracking */}
                        <div className="flex items-center gap-2 text-xs font-semibold">
                            <span className="text-gray-500 uppercase">Workflow:</span>
                            <span className={`px-2 py-1 rounded-md ${getWorkflowColor(order.workflowStatus)} flex items-center`}>
                                {order.workflowStatus === 'PROCUREMENT' && <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
                                {order.workflowStatus === 'DELIVERED' && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                                {order.workflowStatus}
                            </span>
                        </div>
                        
                        {order.procurementRequired && order.status !== 'delivered' && (
                            <div className="mt-3 text-xs font-medium text-orange-600 bg-orange-50 px-3 py-2 rounded border border-orange-100 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                Waiting for procurement from seller
                            </div>
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <Button
                                variant="outlined"
                                color="primary"
                                fullWidth
                                startIcon={<Receipt size={16} />}
                                onClick={() => navigate(`/admin/pos/receipt/${order.orderId}`, { state: { orderData: order } })}
                                className="!rounded-lg !text-sm"
                            >
                                Generate Receipt
                            </Button>
                        </div>
                    </div>
                ))}

                {orders.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No Recent Orders</h3>
                        <p>Orders created from the POS terminal will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
