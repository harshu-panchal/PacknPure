import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { Printer, Download, Share2, ArrowLeft, Plus } from 'lucide-react';
import jsPDF from 'jspdf';
import { posApi } from '../services/posApi';
import { toast } from 'sonner';
import brandLogo from '../../../assets/brand_logo.png';
import { usePosEngine } from '../context/PosEngineContext';

export default function PosReceiptPage() {
    const { role } = usePosEngine();
    const location = useLocation();
    const navigate = useNavigate();
    const { orderId } = useParams();
    const orderData = location.state?.orderData;
    const [receiptSettings, setReceiptSettings] = React.useState({
        storeAddress: '123 Market Street, City',
        gstNumber: '22AAAAA0000A1Z5'
    });

    useEffect(() => {
        try {
            const saved = localStorage.getItem('posSettings');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.storeAddress) setReceiptSettings(prev => ({ ...prev, storeAddress: parsed.storeAddress }));
                if (parsed.gstNumber) setReceiptSettings(prev => ({ ...prev, gstNumber: parsed.gstNumber }));
            }
        } catch (e) {}
    }, []);

    useEffect(() => {
        if (!orderData) {
            // If no order data in state (e.g. refreshed), redirect back to POS
            toast.error("Receipt data not found. Redirecting to POS.");
            navigate(`/${role}/pos/checkout`);
        } else {
            // Auto trigger print after a brief delay for rendering
            const timer = setTimeout(() => {
                window.print();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [orderData, navigate]);

    if (!orderData) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPdf = () => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text("PacknPure Receipt", 20, 20);
            doc.setFontSize(12);
            doc.text(`Order ID: ${orderData.orderId || ''}`, 20, 30);
            doc.text(`Date: ${new Date(orderData.createdAt || Date.now()).toLocaleString()}`, 20, 40);
            
            let y = 60;
            if (orderData.items && Array.isArray(orderData.items)) {
                orderData.items.forEach((item) => {
                    doc.text(`${item.name} x${item.quantity}`, 20, y);
                    doc.text(`Rs ${Number(item.price * item.quantity).toFixed(2)}`, 160, y);
                    y += 10;
                });
            }

            y += 10;
            doc.text(`Total: Rs ${Number(orderData.pricing?.total || 0).toFixed(2)}`, 20, y);
            
            doc.save(`Receipt_${orderData.orderId || 'POS'}.pdf`);
        } catch (e) {
            console.error(e);
            toast.error("Failed to generate PDF");
        }
    };

    const handleShare = async () => {
        try {
            const contact = prompt("Enter customer phone number or email to share (handled by backend):");
            if (!contact) return;
            const isEmail = contact.includes('@');
            await posApi.shareReceipt({
                orderId: orderData.orderId,
                method: isEmail ? 'email' : 'whatsapp',
                contact: contact
            });
            toast.success("Receipt sharing triggered successfully!");
        } catch(error) {
            toast.error("Failed to trigger receipt sharing");
        }
    };

    return (
        <div className="flex flex-col h-full min-h-[calc(100vh-100px)] bg-gray-100 overflow-y-auto w-full rounded-xl">
            <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between shadow-sm sticky top-0 z-10 print:hidden">
                <div className="flex items-center gap-4">
                    <Button 
                        startIcon={<ArrowLeft size={16} />} 
                        onClick={() => navigate(`/${role}/pos/checkout`)}
                        color="inherit"
                    >
                        Back to POS
                    </Button>
                    <h1 className="text-xl font-black text-gray-800">Receipt Generated</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="contained" 
                        color="primary" 
                        startIcon={<Plus size={16} />}
                        onClick={() => navigate(`/${role}/pos/checkout`)}
                        className="!rounded-xl !font-bold"
                    >
                        New Order
                    </Button>
                </div>
            </div>

            <div className="flex-1 p-6 flex justify-center pb-20 mt-4">
                <div className="bg-white shadow-xl rounded-2xl w-full max-w-md overflow-hidden flex flex-col h-max">
                    <div className="p-8 text-sm receipt-content flex-1" id="printable-receipt" style={{ fontFamily: 'monospace' }}>
                        <div className="text-center mb-6 relative">
                            {role === 'seller' && (
                                <img src={brandLogo} alt="PacknPure Watermark" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 w-48 h-48 object-contain pointer-events-none" />
                            )}
                            <img src={brandLogo} alt="PacknPure Logo" className="h-12 mx-auto mb-2 object-contain" />
                            {role === 'seller' && orderData.posDetails?.sellerSnapshot ? (
                                <>
                                    <p className="text-xs text-gray-500 mt-2 uppercase font-bold tracking-widest">Sold By</p>
                                    <p className="font-bold text-gray-800">{orderData.posDetails.sellerSnapshot.businessName}</p>
                                    <p className="text-xs text-gray-400 mt-1">{orderData.posDetails.sellerSnapshot.address}</p>
                                    <p className="text-xs text-gray-400">Phone: {orderData.posDetails.sellerSnapshot.phone}</p>
                                    <p className="text-xs text-gray-400">GSTIN: {orderData.posDetails.sellerSnapshot.gstin}</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs text-gray-500 mt-2 uppercase font-bold tracking-widest">Supermarket & Retail</p>
                                    <p className="text-xs text-gray-400 mt-1">{receiptSettings.storeAddress}</p>
                                    <p className="text-xs text-gray-400">GSTIN: {receiptSettings.gstNumber}</p>
                                </>
                            )}
                        </div>

                        <div className="border-t-2 border-b-2 border-dashed border-gray-300 py-3 mb-4 text-xs">
                            <div className="flex justify-between mb-1">
                                <span className="font-bold">Order ID:</span>
                                <span>{orderData.orderId}</span>
                            </div>
                            <div className="flex justify-between mb-1">
                                <span className="font-bold">Date:</span>
                                <span>{new Date(orderData.createdAt || Date.now()).toLocaleString()}</span>
                            </div>
                            {orderData.posDetails?.cashierId && (
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold">Cashier:</span>
                                    <span>{String(orderData.posDetails.cashierId).slice(-6).toUpperCase()}</span>
                                </div>
                            )}
                            {orderData.guestCustomer?.name && (
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold">Customer:</span>
                                    <span>{orderData.guestCustomer.name}</span>
                                </div>
                            )}
                        </div>

                        <table className="w-full text-xs mb-4">
                            <thead>
                                <tr className="border-b-2 border-dashed border-gray-300">
                                    <th className="text-left py-2 w-1/2">ITEM</th>
                                    <th className="text-center py-2 w-1/6">QTY</th>
                                    <th className="text-right py-2 w-1/6">RATE</th>
                                    <th className="text-right py-2 w-1/6">AMT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orderData.items?.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="py-2 pr-2">
                                            <div className="font-bold">{item.name}</div>
                                            {item.variantId && <div className="text-[10px] text-gray-500">Var: {String(item.variantId).slice(-4)}</div>}
                                        </td>
                                        <td className="py-2 text-center align-top">{item.quantity}</td>
                                        <td className="py-2 text-right align-top">{(item.price).toFixed(2)}</td>
                                        <td className="py-2 text-right align-top">{(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="border-t-2 border-dashed border-gray-300 pt-3 space-y-2 text-xs">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span>₹{Number(orderData.pricing?.subtotal || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>GST Included</span>
                                <span>₹{Number(orderData.pricing?.gst || 0).toFixed(2)}</span>
                            </div>
                            {orderData.pricing?.discount > 0 && (
                                <div className="flex justify-between text-green-600 font-bold">
                                    <span>Discount</span>
                                    <span>-₹{Number(orderData.pricing?.discount || 0).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-black text-lg mt-3 pt-3 border-t-2 border-gray-800">
                                <span>NET PAYABLE</span>
                                <span>₹{Number(orderData.pricing?.total || 0).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="mt-8 pt-4 border-t-2 border-dashed border-gray-300 text-center text-xs">
                            <p className="font-bold mb-1">Thank you for shopping with us!</p>
                            <p className="text-gray-500">Visit again</p>
                            <div className="mt-4 flex justify-center">
                                <div className="w-48 h-10 bg-gray-200 flex items-center justify-center border border-gray-400" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #000 0, #000 2px, transparent 2px, transparent 5px, #000 5px, #000 8px, transparent 8px, transparent 10px)' }}>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">{orderData.orderId}</p>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2 justify-center print:hidden">
                        <Button 
                            variant="outlined" 
                            color="inherit" 
                            startIcon={<Share2 size={16} />}
                            onClick={handleShare}
                            className="!rounded-xl !text-xs !py-2 flex-1"
                        >
                            Share
                        </Button>
                        <Button 
                            variant="outlined" 
                            color="inherit" 
                            startIcon={<Download size={16} />}
                            onClick={handleDownloadPdf}
                            className="!rounded-xl !text-xs !py-2 flex-1"
                        >
                            PDF
                        </Button>
                        <Button 
                            variant="contained" 
                            color="primary" 
                            startIcon={<Printer size={16} />}
                            onClick={handlePrint}
                            className="!rounded-xl !font-bold !text-xs !py-2 flex-[2]"
                        >
                            Print
                        </Button>
                    </div>
                </div>
            </div>
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-receipt, #printable-receipt * {
                        visibility: visible;
                    }
                    #printable-receipt {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 0;
                    }
                }
            `}</style>
        </div>
    );
}
