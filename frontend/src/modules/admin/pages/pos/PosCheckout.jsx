import React, { useState, useEffect } from 'react';
import { ProductSearch } from '../../components/pos/ProductSearch';
import { PosCart } from '../../components/pos/PosCart';
import { CustomerPanel } from '../../components/pos/CustomerPanel';
import { SummaryPanel } from '../../components/pos/SummaryPanel';
import { PaymentModal } from '../../components/pos/PaymentModal';
import { ReceiptModal } from '../../components/pos/ReceiptModal';
import { usePosCart } from '../../context/PosCartContext';
import { usePosSession } from '../../context/PosSessionContext';
import { posApi } from '../../services/posApi';
import { toast } from 'sonner';

export default function PosCheckout() {
    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    const [isReceiptModalOpen, setReceiptModalOpen] = useState(false);
    const [receiptData, setReceiptData] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const { cart, cartTotals, guestCustomer, manualDiscount, clearCart, fulfillmentType, deliveryAddress } = usePosCart();
    const { activeSession, activeTerminal } = usePosSession();

    // F4 Shortcut to open Checkout
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F4' && cart.length > 0 && !isPaymentModalOpen) {
                e.preventDefault();
                setPaymentModalOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart.length, isPaymentModalOpen]);

    const handleCheckoutClick = () => {
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }
        setPaymentModalOpen(true);
    };

    const processPayment = async (paymentDetails) => {
        setIsProcessing(true);
        try {
            // Generate idempotency key for this checkout attempt
            const idempotencyKey = crypto.randomUUID();

            const payload = {
                items: cart.map(c => ({
                    product: c.product,
                    variantId: c.variantId,
                    quantity: c.quantity,
                    price: c.price,
                    purchasePrice: c.purchasePrice,
                    gstEnabled: c.gstEnabled,
                    gstRate: c.gstRate
                })),
                payment: paymentDetails,
                pricing: {
                    subtotal: cartTotals.subtotal,
                    gst: cartTotals.totalGst,
                    discount: cartTotals.discount,
                    total: cartTotals.total
                },
                guestCustomer: guestCustomer.phone ? guestCustomer : null,
                fulfillmentDetails: {
                    type: fulfillmentType,
                    address: fulfillmentType === 'HOME_DELIVERY' ? deliveryAddress : null
                },
                posDetails: {
                    posTerminalId: activeTerminal,
                    posSessionId: activeSession?._id
                },
                discountDetails: manualDiscount.amount > 0 ? {
                    type: 'manual',
                    amount: manualDiscount.amount,
                    reason: manualDiscount.reason
                } : undefined
            };

            const { data } = await posApi.processCheckout(payload, idempotencyKey);
            
            if (data.success) {
                toast.success("Payment successful! Receipt generated.");
                setReceiptData(data.data);
                setReceiptModalOpen(true);
                clearCart();
                setPaymentModalOpen(false);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Checkout failed. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-auto min-h-[calc(100vh-64px)] lg:h-[calc(100vh-64px)] w-full overflow-y-auto lg:overflow-hidden bg-gray-100 p-2 sm:p-4 gap-4">
            {/* Left Side: Search & Cart */}
            <div className="flex flex-col w-full lg:flex-[2] lg:min-w-[60%] gap-4 h-auto lg:h-full">
                <ProductSearch />
                <div className="flex-1 min-h-[300px] lg:min-h-0">
                    <PosCart />
                </div>
            </div>

            {/* Right Side: Customer & Summary */}
            <div className="flex flex-col w-full lg:flex-1 lg:min-w-[300px] lg:max-w-md gap-4 h-auto lg:h-full lg:overflow-y-auto pb-20 lg:pb-0">
                <CustomerPanel />
                <SummaryPanel onCheckoutClick={handleCheckoutClick} />
            </div>

            <PaymentModal 
                open={isPaymentModalOpen} 
                onOpenChange={setPaymentModalOpen} 
                total={cartTotals.total}
                onProcessPayment={processPayment}
                isProcessing={isProcessing}
            />

            <ReceiptModal 
                open={isReceiptModalOpen} 
                onOpenChange={setReceiptModalOpen} 
                orderData={receiptData} 
            />
        </div>
    );
}
