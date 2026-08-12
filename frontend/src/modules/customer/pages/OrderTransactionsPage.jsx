import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ArrowUpRight, ArrowDownLeft, ReceiptIndianRupee } from 'lucide-react';
import { customerApi } from '../services/customerApi';

const calculateOrderAmount = (order) => {
    if (!order) return 0;

    // 1. Check pricing object
    const pricingTotal = Number(order.pricing?.total ?? order.pricing?.grandTotal);
    if (!isNaN(pricingTotal) && pricingTotal > 0) return pricingTotal;

    // 2. Check payment paidAmount / amount
    const paidAmount = Number(order.payment?.paidAmount ?? order.payment?.amount);
    if (!isNaN(paidAmount) && paidAmount > 0) return paidAmount;

    // 3. Top-level total/amount fields
    const topTotal = Number(order.totalAmount ?? order.payableAmount ?? order.grandTotal ?? order.total ?? order.amount);
    if (!isNaN(topTotal) && topTotal > 0) return topTotal;

    // 4. Subtotal + fees calculation in pricing
    const subtotal = Number(order.pricing?.subtotal || 0);
    const deliveryFee = Number(order.pricing?.deliveryFee || 0);
    const platformFee = Number(order.pricing?.platformFee || 0);
    const tax = Number(order.pricing?.gst || 0);
    const calculatedSub = subtotal + deliveryFee + platformFee + tax;
    if (calculatedSub > 0) return calculatedSub;

    // 5. Fallback sum of items
    if (Array.isArray(order.items) && order.items.length > 0) {
        const itemsSum = order.items.reduce((sum, item) => {
            const price = Number(item.price ?? item.salePrice ?? item.unitPrice ?? item.finalCost ?? 0);
            const qty = Number(item.quantity ?? 1);
            return sum + (price * qty);
        }, 0);
        if (itemsSum > 0) return itemsSum;
    }

    return 0;
};

const OrderTransactionsPage = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const res = await customerApi.getMyOrders();
                setOrders(res.data.results || []);
            } catch (error) {
                console.error('Failed to fetch orders for transaction history:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 pb-24 font-sans">
            <main className="max-w-2xl mx-auto px-4 pt-4 relative z-20">
                <div className="mb-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="shrink-0 rounded-full p-1.5 hover:bg-slate-200/70 transition-colors -ml-1.5"
                            aria-label="Back"
                        >
                            <ChevronLeft size={22} className="text-slate-900" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Order Transactions</h1>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-slate-800">Transaction History</h3>
                            <p className="text-[11px] text-slate-500">
                                Based on your recent orders
                            </p>
                        </div>
                        <ReceiptIndianRupee className="h-5 w-5 text-slate-400" />
                    </div>

                    {loading ? (
                        <div className="py-10 flex items-center justify-center text-xs text-slate-400 font-semibold">
                            Loading transactions...
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="py-10 flex flex-col items-center justify-center text-center px-6">
                            <p className="text-sm font-semibold text-slate-500 mb-1">
                                No transactions yet
                            </p>
                            <p className="text-[11px] text-slate-400">
                                Place an order to see your payment history here.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {orders.map((order) => {
                                const isRefund = order.paymentStatus === 'refunded' || order.payment?.status === 'refunded' || order.status === 'refunded';
                                const amount = calculateOrderAmount(order);
                                const createdAt = order.createdAt ? new Date(order.createdAt) : null;
                                const paymentMethod = order.paymentMethod || order.payment?.method || order.payment?.paymentMode || 'Online';

                                return (
                                    <div
                                        key={order._id}
                                        className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                                    isRefund
                                                        ? 'bg-amber-50 text-amber-600'
                                                        : 'bg-slate-100 text-slate-700'
                                                }`}
                                            >
                                                {isRefund ? (
                                                    <ArrowUpRight size={19} />
                                                ) : (
                                                    <ArrowDownLeft size={19} />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-800 text-sm">
                                                    {isRefund ? 'Refund' : 'Order Payment'}
                                                </h4>
                                                <p className="text-[11px] text-slate-500 capitalize">
                                                    #{order.orderId || order._id?.slice(-8)} •{' '}
                                                    {paymentMethod}
                                                </p>
                                                {createdAt && (
                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                        {createdAt.toLocaleDateString()},{' '}
                                                        {createdAt.toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div
                                            className={`text-sm font-semibold ${
                                                isRefund ? 'text-amber-600' : 'text-slate-900'
                                            }`}
                                        >
                                            {isRefund ? '+' : '-'}₹{amount.toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default OrderTransactionsPage;

