import React, { useState } from 'react';
import { RotateCcw, Search, AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@mui/material';
import { posApi } from '../../services/posApi';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Returns() {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [order, setOrder] = useState(null);
    
    // For processing return
    const [returnItems, setReturnItems] = useState({});
    const [reason, setReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery) return;
        
        setIsSearching(true);
        // Note: We are using the getOrders endpoint and filtering client-side for simplicity here,
        // in a real app you'd add a GET /api/v1/pos/orders/:id endpoint
        try {
            const { data } = await posApi.getOrders();
            if (data.success) {
                const found = data.results?.find(o => o.orderId === searchQuery || o.receiptNumber === searchQuery);
                if (found) {
                    setOrder(found);
                    setReturnItems({});
                    setReason('');
                } else {
                    toast.error("Order not found or not a POS order");
                    setOrder(null);
                }
            }
        } catch (error) {
            toast.error("Failed to find order");
        } finally {
            setIsSearching(false);
        }
    };

    const handleQuantityChange = (itemId, maxQty, delta) => {
        setReturnItems(prev => {
            const current = prev[itemId] || 0;
            const next = Math.max(0, Math.min(maxQty, current + delta));
            
            if (next === 0) {
                const newObj = { ...prev };
                delete newObj[itemId];
                return newObj;
            }
            
            return { ...prev, [itemId]: next };
        });
    };

    const calculateRefund = () => {
        if (!order) return 0;
        let total = 0;
        order.items.forEach(item => {
            const qty = returnItems[item._id] || 0;
            total += qty * item.price;
        });
        return total;
    };

    const handleProcessReturn = async () => {
        const refundTotal = calculateRefund();
        if (refundTotal <= 0) {
            toast.error("Select at least one item to return");
            return;
        }
        if (!reason) {
            toast.error("Please provide a reason for return");
            return;
        }

        setIsProcessing(true);
        try {
            const payload = {
                orderId: order.orderId,
                reason,
                items: order.items
                    .filter(item => returnItems[item._id] > 0)
                    .map(item => ({
                        productId: item.product,
                        variantId: item.variantId || null,
                        qty: returnItems[item._id]
                    }))
            };

            const { data } = await posApi.returnOrder(payload);
            
            if (data.success) {
                toast.success(`Return processed. Refund Amount: ₹${data.data?.refundAmount || refundTotal}`);
                setOrder(null);
                setSearchQuery('');
                setReturnItems({});
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Return failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <RotateCcw className="mr-3 w-7 h-7 text-orange-600" />
                        Process Returns & Refunds
                    </h1>
                    <p className="text-gray-500 mt-1">Inventory will automatically be restocked into the Hub</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                <form onSubmit={handleSearch} className="p-6 border-b border-gray-100 flex gap-4 bg-gray-50">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Enter Order ID or Receipt Number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-lg font-medium"
                        />
                    </div>
                    <Button 
                        type="submit" 
                        variant="contained" 
                        color="warning" 
                        size="large"
                        disabled={isSearching || !searchQuery}
                        className="!font-bold !px-8"
                    >
                        {isSearching ? "Searching..." : "Find Order"}
                    </Button>
                </form>

                {order ? (
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-100">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-1">Order #{order.orderId}</h2>
                                <p className="text-sm text-gray-500">Date: {format(new Date(order.createdAt), 'PPpp')}</p>
                                <p className="text-sm font-semibold text-gray-700 mt-2">
                                    Customer: {order.guestCustomer?.name || 'Walk-in'} {order.guestCustomer?.phone && `(${order.guestCustomer.phone})`}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-gray-500">Total Paid</div>
                                <div className="text-2xl font-black text-gray-900">₹{order.pricing?.total}</div>
                                <div className="text-sm font-semibold text-blue-600 mt-1 uppercase">Method: {order.payment?.method}</div>
                            </div>
                        </div>

                        <h3 className="font-bold text-gray-800 mb-4">Select Items to Return</h3>
                        <div className="space-y-4 mb-8">
                            {order.items.map(item => {
                                const maxReturnable = item.quantity - (item.returnedQty || 0);
                                const currentReturn = returnItems[item._id] || 0;
                                const isFullyReturned = maxReturnable === 0;

                                return (
                                    <div key={item._id} className={`flex items-center justify-between p-4 rounded-lg border ${currentReturn > 0 ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-900">{item.name}</div>
                                            <div className="text-sm text-gray-500">
                                                {item.variantName && <span className="mr-2">{item.variantName}</span>}
                                                ₹{item.price} x {item.quantity} purchased
                                            </div>
                                            {item.returnedQty > 0 && (
                                                <div className="text-xs font-semibold text-red-500 mt-1">Already returned: {item.returnedQty}</div>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center gap-4">
                                            <div className="text-right mr-4">
                                                <div className="font-bold text-gray-900">₹{item.price * currentReturn}</div>
                                                <div className="text-xs text-gray-500">Refund value</div>
                                            </div>

                                            {isFullyReturned ? (
                                                <span className="px-3 py-1 bg-gray-100 text-gray-500 text-sm font-bold rounded">Returned</span>
                                            ) : (
                                                <div className="flex items-center bg-white border border-gray-300 rounded overflow-hidden shadow-sm">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleQuantityChange(item._id, maxReturnable, -1)}
                                                        className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold border-r border-gray-300"
                                                    >-</button>
                                                    <span className="w-12 text-center font-bold text-gray-900">{currentReturn} / {maxReturnable}</span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleQuantityChange(item._id, maxReturnable, 1)}
                                                        className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold border-l border-gray-300"
                                                    >+</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 flex flex-col md:flex-row gap-6 items-center justify-between">
                            <div className="flex-1 w-full">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Reason for Return</label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Customer requested exchange, item damaged, etc."
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                                    rows="2"
                                />
                            </div>
                            
                            <div className="bg-orange-100 p-4 rounded-lg border border-orange-200 min-w-[250px] text-center">
                                <div className="text-orange-800 font-medium text-sm mb-1">Total Refund Amount</div>
                                <div className="text-3xl font-black text-orange-900 mb-3">₹{calculateRefund()}</div>
                                <Button 
                                    variant="contained" 
                                    color="warning" 
                                    fullWidth
                                    onClick={handleProcessReturn}
                                    disabled={calculateRefund() === 0 || isProcessing || !reason}
                                    className="!font-bold"
                                    startIcon={<RefreshCcw />}
                                >
                                    {isProcessing ? "Processing..." : "Issue Refund"}
                                </Button>
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="py-20 text-center text-gray-500">
                        <AlertCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-medium text-gray-800 mb-2">Search for an Order</h3>
                        <p>Scan barcode on receipt or enter order ID to process a return.</p>
                    </div>
                )}
            </div>
        </div>
    );
}