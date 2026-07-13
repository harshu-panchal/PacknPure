import React from 'react';
import { Button, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { Printer, Download, Share2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { posApi } from '../../services/posApi';
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
                <div className="p-6 text-sm receipt-content" id="printable-receipt">
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-black">PacknPure</h2>
                        <p className="text-gray-500">Retail Invoice</p>
                    </div>

                    <div className="mb-4 text-xs space-y-1 text-gray-600">
                        <p>Order ID: {orderData.orderId}</p>
                        <p>Date: {new Date(orderData.createdAt || Date.now()).toLocaleString()}</p>
                        {orderData.posDetails?.cashierId && <p>Cashier ID: {orderData.posDetails.cashierId}</p>}
                    </div>

                    <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left font-bold text-xs text-gray-700">
                                    <th className="pb-2">Item</th>
                                    <th className="pb-2 text-right">Qty</th>
                                    <th className="pb-2 text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orderData.items?.map((item, idx) => (
                                    <tr key={idx} className="text-xs">
                                        <td className="py-1">{item.name}</td>
                                        <td className="py-1 text-right">{item.quantity}</td>
                                        <td className="py-1 text-right">₹{Number(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal</span>
                            <span>₹{Number(orderData.pricing?.subtotal || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>GST</span>
                            <span>₹{Number(orderData.pricing?.gst || 0).toFixed(2)}</span>
                        </div>
                        {orderData.pricing?.discount > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Discount</span>
                                <span>-₹{Number(orderData.pricing?.discount || 0).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-gray-200">
                            <span>Total</span>
                            <span>₹{Number(orderData.pricing?.total || 0).toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="mt-8 text-center text-xs text-gray-500">
                        <p>Thank you for shopping with us!</p>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between gap-2 print:hidden">
                    <Button variant="outlined" size="small" onClick={handleDownloadPdf}>
                        <Download className="w-4 h-4 mr-2"/> PDF
                    </Button>
                    <Button variant="outlined" size="small" onClick={handleShare}>
                        <Share2 className="w-4 h-4 mr-2"/> Share
                    </Button>
                    <Button variant="contained" size="small" onClick={handlePrint} color="primary">
                        <Printer className="w-4 h-4 mr-2"/> Print
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
                    }
                }
            `}} />
        </Dialog>
    );
};
