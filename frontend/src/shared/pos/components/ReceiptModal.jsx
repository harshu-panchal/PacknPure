import React from 'react';
import { Button, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { Printer, Download, Share2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { posApi } from '../services/posApi';
import { toast } from 'sonner';

export const ReceiptModal = ({ open, onOpenChange, orderData }) => {
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
        <Dialog 
            open={open} 
            onClose={() => onOpenChange(false)}
            maxWidth="xs"
            fullWidth
            PaperProps={{ className: "overflow-hidden bg-white rounded-xl" }}
        >
            <div className="p-4 bg-gray-50 border-b border-gray-100 print:hidden">
                <h2 className="text-lg font-bold text-center m-0">Receipt</h2>
            </div>

            <DialogContent className="!p-0">
                <div className="p-6 text-sm receipt-content" id="printable-receipt" style={{ fontFamily: 'monospace' }}>
                    <div className="text-center mb-6">
                        <img src="/packnpure-icon.svg" alt="PacknPure Logo" className="h-12 mx-auto mb-2 opacity-90 filter grayscale" />
                        <h2 className="text-2xl font-black tracking-tight">PacknPure</h2>
                        <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-widest">Supermarket & Retail</p>
                        <p className="text-xs text-gray-400 mt-1">123 Market Street, City</p>
                        <p className="text-xs text-gray-400">GSTIN: 22AAAAA0000A1Z5</p>
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
                                <span>{orderData.posDetails.cashierId.slice(-6).toUpperCase()}</span>
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
                            {/* Barcode Placeholder */}
                            <div className="w-48 h-10 bg-gray-200 flex items-center justify-center border border-gray-400" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #000 0, #000 2px, transparent 2px, transparent 5px, #000 5px, #000 8px, transparent 8px, transparent 10px)' }}>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">{orderData.orderId}</p>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between gap-2 print:hidden">
                    <Button variant="outlined" size="small" onClick={handleDownloadPdf} className="!font-bold">
                        <Download className="w-4 h-4 mr-2"/> PDF
                    </Button>
                    <Button variant="outlined" size="small" onClick={handleShare} className="!font-bold">
                        <Share2 className="w-4 h-4 mr-2"/> Share
                    </Button>
                    <Button variant="contained" size="small" onClick={handlePrint} color="primary" className="!font-bold !bg-slate-900">
                        <Printer className="w-4 h-4 mr-2"/> Print Bill
                    </Button>
                </div>
            </DialogContent>
            
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .receipt-content, .receipt-content * {
                        visibility: visible;
                    }
                    .receipt-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 80mm;
                        margin: 0;
                        padding: 10px;
                        color: #000 !important;
                    }
                }
            `}} />
        </Dialog>
    );
};
