import React, { useState, useEffect } from 'react';
import { Button, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { Banknote, CreditCard, Smartphone, Wallet, Loader2 } from 'lucide-react';
import { posApi } from '../../services/posApi';
import { toast } from 'sonner';

const loadRazorpay = () => {
    return new Promise((resolve) => {
        if (window.Razorpay) {
            return resolve(true);
        }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

export const PaymentModal = ({ open, onOpenChange, total, onProcessPayment, isProcessing }) => {
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [paidAmount, setPaidAmount] = useState(total);

    useEffect(() => {
        if (open) {
            setPaidAmount(total);
            setPaymentMethod('cash');
        }
    }, [open, total]);

    const changeDue = Math.max(0, paidAmount - total);
    const isAmountValid = paidAmount >= total;

    const handleQuickAmount = (amount) => {
        setPaidAmount(prev => Number(prev) + amount);
    };

    const handleExact = () => {
        setPaidAmount(total);
    };

    const handlePaymentSubmit = async () => {
        if (!isAmountValid) return;
        
        if (paymentMethod === 'upi' || paymentMethod === 'card') {
            try {
                const isLoaded = await loadRazorpay();
                if (!isLoaded) {
                    toast.error("Failed to load Razorpay SDK. Check your connection.");
                    return;
                }

                // Get Razorpay Config Key
                const configRes = await posApi.getPaymentConfig();
                const razorpayKey = configRes.data?.result?.razorpayKey;
                if (!razorpayKey) throw new Error("Could not fetch payment configuration");

                // Create Order on Backend
                const orderRes = await posApi.createRazorpayOrder({ amount: total });
                const orderData = orderRes.data?.result;

                if (!orderData?.id) throw new Error("Failed to create online payment order");

                const options = {
                    key: razorpayKey,
                    amount: orderData.amount,
                    currency: orderData.currency,
                    name: "PacknPure POS",
                    description: "POS Checkout",
                    order_id: orderData.id,
                    handler: function (response) {
                        onProcessPayment({
                            method: paymentMethod,
                            paidAmount: Number(total), // online payment is exact
                            changeReturned: 0,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature
                        });
                    },
                    theme: {
                        color: "#2563EB",
                    },
                    modal: {
                        ondismiss: function() {
                            toast.error("Payment was cancelled");
                        }
                    }
                };

                const rzp = new window.Razorpay(options);
                rzp.on("payment.failed", function (response) {
                    toast.error(response.error.description);
                });
                rzp.open();

            } catch (error) {
                console.error("Payment initialization failed:", error);
                toast.error("Failed to initialize payment gateway");
            }
        } else {
            onProcessPayment({
                method: paymentMethod,
                paidAmount: Number(paidAmount),
                changeReturned: changeDue
            });
        }
    };

    // Keyboard shortcut for Enter
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (open && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handlePaymentSubmit();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, isAmountValid, paidAmount, paymentMethod]);

    return (
        <Dialog 
            open={open} 
            onClose={() => !isProcessing && onOpenChange(false)} 
            maxWidth="sm" 
            fullWidth
            PaperProps={{ className: "overflow-hidden rounded-xl" }}
        >
            <div className="p-6 bg-gray-50 border-b border-gray-100">
                <h2 className="text-xl font-bold flex items-center m-0">
                    Complete Payment
                </h2>
            </div>
            
            <DialogContent className="!p-0">
                <div className="p-6 space-y-6">
                    {/* Amount to Pay */}
                    <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <span className="text-blue-800 font-semibold">Total Due</span>
                        <span className="text-3xl font-black text-blue-700">₹{total.toFixed(2)}</span>
                    </div>

                    {/* Payment Methods */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Payment Method</label>
                        <div className="grid grid-cols-4 gap-3">
                            <MethodBtn 
                                id="cash" label="Cash" icon={Banknote} 
                                active={paymentMethod} onClick={setPaymentMethod} 
                            />
                            <MethodBtn 
                                id="upi" label="UPI" icon={Smartphone} 
                                active={paymentMethod} onClick={setPaymentMethod} 
                            />
                            <MethodBtn 
                                id="card" label="Card" icon={CreditCard} 
                                active={paymentMethod} onClick={setPaymentMethod} 
                            />
                            <MethodBtn 
                                id="wallet" label="Wallet" icon={Wallet} 
                                active={paymentMethod} onClick={setPaymentMethod} 
                            />
                        </div>
                    </div>

                    {/* Cash Tendered & Change */}
                    {paymentMethod === 'cash' && (
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Tendered Amount</label>
                                <input 
                                    type="number" 
                                    value={paidAmount}
                                    onChange={(e) => setPaidAmount(e.target.value)}
                                    className="w-full text-2xl font-bold p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0"
                                    min={total}
                                />
                                <div className="flex gap-2 mt-2">
                                    <button onClick={handleExact} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition">Exact</button>
                                    <button onClick={() => handleQuickAmount(100)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition">+100</button>
                                    <button onClick={() => handleQuickAmount(500)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition">+500</button>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center text-lg">
                                <span className="text-gray-600 font-medium">Change Due</span>
                                <span className={`font-bold ${changeDue > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                    ₹{changeDue.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-4">
                    <Button 
                        variant="outlined" 
                        color="inherit" 
                        fullWidth 
                        size="large"
                        onClick={() => onOpenChange(false)}
                        disabled={isProcessing}
                    >
                        Cancel (Esc)
                    </Button>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        fullWidth 
                        size="large"
                        onClick={handlePaymentSubmit}
                        disabled={!isAmountValid || isProcessing}
                        className="!font-bold relative"
                    >
                        {isProcessing ? (
                            <span className="flex items-center"><Loader2 className="w-5 h-5 animate-spin mr-2"/> Processing...</span>
                        ) : (
                            "Confirm & Print (Ctrl+Enter)"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const MethodBtn = ({ id, label, icon: Icon, active, onClick }) => {
    const isActive = active === id;
    return (
        <button
            onClick={() => onClick(id)}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                isActive 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-gray-200 bg-white text-gray-500 hover:border-blue-200 hover:bg-gray-50'
            }`}
        >
            <Icon className={`w-6 h-6 mb-2 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
            <span className="text-xs font-semibold">{label}</span>
        </button>
    );
};
