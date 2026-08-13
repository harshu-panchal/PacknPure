import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@core/context/SettingsContext';
import { brandColor } from '../../constants/brandTheme';
import { resolveOrderItemVariantLabel } from '@/shared/utils/orderItemDisplay';

function formatInr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

const InvoiceModal = ({ isOpen, onClose, order }) => {
    const { settings } = useSettings();
    const appName = settings?.appName || 'Pack n Pure';
    const primaryColor = brandColor(settings);

    if (!isOpen || !order) return null;

    const items = order.items || [];
    const pricing = order.pricing || order.bill || {};
    const address = order.address || {};
    const orderRef = order.orderId || order.id || '—';
    const createdDate = order.createdAt ? new Date(order.createdAt) : new Date();

    const subtotal =
      pricing.subtotal ??
      pricing.itemTotal ??
      items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || item.qty || 0), 0);
    const tax = pricing.gst ?? pricing.tax ?? 0;
    const deliveryFee = pricing.deliveryFee ?? 0;
    const platformFee = pricing.platformFee ?? 0;
    const discount = pricing.discount ?? 0;
    const grandTotal = pricing.total ?? pricing.grandTotal ?? (subtotal + tax + deliveryFee + platformFee - discount);

    const rawMethod = String(
        order.paymentMethod || order.payment?.method || order.payment?.paymentMode || 'cash'
    ).toLowerCase();
    const displayPaymentMethod = ['cod', 'cash'].includes(rawMethod) ? 'Cash' : 'Online';

    const handlePrint = () => {
        window.print();
    };

    const handleSavePdf = async () => {
        try {
            const { default: jsPDF } = await import('jspdf');
            const doc = new jsPDF('p', 'mm', 'a4');

            const pw = doc.internal.pageSize.getWidth();
            let y = 15;

            // Brand & Header
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(226, 55, 68); // #E23744
            doc.text(appName.toUpperCase(), 14, y);

            doc.setFontSize(10);
            doc.setTextColor(50, 50, 50);
            doc.text('TAX INVOICE', pw - 14, y, { align: 'right' });
            y += 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(settings?.companyName || 'Pack n Pure Quick Commerce Private Limited', 14, y);
            doc.setTextColor(50, 50, 50);
            doc.text(`Order ID: #${orderRef}`, pw - 14, y, { align: 'right' });
            y += 5;

            doc.setTextColor(100, 100, 100);
            doc.text(settings?.address || 'Indore, Madhya Pradesh, India', 14, y);
            doc.text(`Date: ${createdDate.toLocaleDateString('en-IN')} ${createdDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, pw - 14, y, { align: 'right' });
            y += 5;

            if (settings?.supportPhone) {
                doc.text(`Phone: ${settings.supportPhone}`, 14, y);
            }
            doc.text(`Payment: ${displayPaymentMethod}`, pw - 14, y, { align: 'right' });
            y += 8;

            // Line separator
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.5);
            doc.line(14, y, pw - 14, y);
            y += 8;

            // Customer Details
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('CUSTOMER DETAILS / BILL TO:', 14, y);
            doc.text('FULFILLED BY:', pw - 14, y, { align: 'right' });
            y += 5;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(20, 20, 20);
            doc.text(address.name || 'Customer', 14, y);
            doc.text(`${appName} Partner Hub`, pw - 14, y, { align: 'right' });
            y += 5;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            doc.text(address.phone || '—', 14, y);
            doc.text('Express Doorstep Delivery', pw - 14, y, { align: 'right' });
            y += 5;

            if (address.address) {
                const addrStr = `${address.address}${address.city ? `, ${address.city}` : ''}`;
                doc.text(addrStr, 14, y, { maxWidth: 100 });
            }
            y += 10;

            // Items Table Header
            doc.setFillColor(245, 247, 250);
            doc.rect(14, y, pw - 28, 8, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(60, 60, 60);

            doc.text('#', 18, y + 5.5);
            doc.text('ITEM DESCRIPTION', 30, y + 5.5);
            doc.text('QTY', 125, y + 5.5, { align: 'center' });
            doc.text('PRICE', 155, y + 5.5, { align: 'right' });
            doc.text('AMOUNT', pw - 18, y + 5.5, { align: 'right' });
            y += 10;

            // Table Rows
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(30, 30, 30);

            items.forEach((item, idx) => {
                const variantLabel = resolveOrderItemVariantLabel(item);
                const qty = item.quantity ?? item.qty ?? 1;
                const unitPrice = Number(item.price || 0);
                const itemTotal = unitPrice * qty;

                doc.text(String(idx + 1), 18, y);
                doc.setFont('helvetica', 'bold');
                doc.text(String(item.name || ''), 30, y, { maxWidth: 85 });
                doc.setFont('helvetica', 'normal');

                if (variantLabel) {
                    doc.setFontSize(7.5);
                    doc.setTextColor(120, 120, 120);
                    doc.text(variantLabel, 30, y + 4);
                    doc.setFontSize(9);
                    doc.setTextColor(30, 30, 30);
                }

                doc.text(String(qty), 125, y, { align: 'center' });
                doc.text(`Rs. ${unitPrice.toLocaleString('en-IN')}`, 155, y, { align: 'right' });
                doc.setFont('helvetica', 'bold');
                doc.text(`Rs. ${itemTotal.toLocaleString('en-IN')}`, pw - 18, y, { align: 'right' });
                doc.setFont('helvetica', 'normal');

                y += variantLabel ? 10 : 7;

                doc.setDrawColor(240, 240, 240);
                doc.line(14, y - 3, pw - 14, y - 3);
            });

            y += 4;

            // Totals
            const rightX = pw - 18;
            const labelX = pw - 75;

            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);

            doc.text('Items Subtotal:', labelX, y);
            doc.text(`Rs. ${subtotal.toLocaleString('en-IN')}`, rightX, y, { align: 'right' });
            y += 5;

            if (Number(deliveryFee) > 0) {
                doc.text('Delivery Charges:', labelX, y);
                doc.text(`Rs. ${deliveryFee.toLocaleString('en-IN')}`, rightX, y, { align: 'right' });
                y += 5;
            }

            if (Number(platformFee) > 0) {
                doc.text('Platform Fee:', labelX, y);
                doc.text(`Rs. ${platformFee.toLocaleString('en-IN')}`, rightX, y, { align: 'right' });
                y += 5;
            }

            if (Number(tax) > 0) {
                doc.text('GST / Taxes:', labelX, y);
                doc.text(`Rs. ${tax.toLocaleString('en-IN')}`, rightX, y, { align: 'right' });
                y += 5;
            }

            if (Number(discount) > 0) {
                doc.setTextColor(16, 185, 129);
                doc.text('Discount Applied:', labelX, y);
                doc.text(`-Rs. ${discount.toLocaleString('en-IN')}`, rightX, y, { align: 'right' });
                doc.setTextColor(80, 80, 80);
                y += 5;
            }

            doc.setDrawColor(20, 20, 20);
            doc.setLineWidth(0.7);
            doc.line(labelX, y, rightX, y);
            y += 6;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(20, 20, 20);
            doc.text('Grand Total Paid:', labelX, y);
            doc.text(`Rs. ${grandTotal.toLocaleString('en-IN')}`, rightX, y, { align: 'right' });
            y += 12;

            // Footer note
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(140, 140, 140);
            doc.text(`Thank you for ordering with ${appName}!`, pw / 2, y, { align: 'center' });
            y += 4;
            doc.text('This is a computer-generated tax invoice and requires no physical signature.', pw / 2, y, { align: 'center' });

            doc.save(`Invoice_${orderRef}.pdf`);
        } catch (err) {
            console.error('PDF generation error:', err);
            window.print();
        }
    };

    const modalContent = (
        <div className="customer-invoice-portal-root">
            <AnimatePresence>
                {isOpen && (
                    <div 
                        onClick={onClose}
                        className="customer-invoice-backdrop fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto cursor-pointer"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                            onClick={(e) => e.stopPropagation()}
                            className="customer-invoice-modal bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-auto border border-slate-100 cursor-default"
                        >
                            {/* Toolbar (Screen Only - Hidden when printing) */}
                            <div className="no-print bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
                                <div className="flex items-center gap-2">
                                    <Receipt className="h-5 w-5 text-rose-400" />
                                    <div>
                                        <h2 className="text-base font-bold tracking-tight">Tax Invoice & Order Bill</h2>
                                        <p className="text-xs text-slate-400 font-mono">#{orderRef}</p>
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClose();
                                    }} 
                                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-slate-300 hover:text-white cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Printable Invoice Body */}
                            <div className="customer-printable-invoice p-6 sm:p-8 bg-white text-slate-900 font-sans" id="printable-invoice">
                                {/* Header Info */}
                                <div className="flex justify-between items-start pb-6 border-b-2 border-slate-900 gap-4">
                                    <div>
                                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase" style={{ color: primaryColor }}>
                                            {appName}
                                        </h1>
                                        <p className="text-xs font-semibold text-slate-600 mt-1">
                                            {settings?.companyName || 'Pack n Pure Quick Commerce Private Limited'}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5 max-w-xs leading-relaxed">
                                            {settings?.address || 'Indore, Madhya Pradesh, India'}
                                        </p>
                                        {settings?.supportPhone && (
                                            <p className="text-xs text-slate-500 mt-0.5">Phone: {settings.supportPhone}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="inline-block px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                                            TAX INVOICE
                                        </span>
                                        <p className="text-xs font-bold text-slate-800">Order ID: <span className="font-mono text-slate-900">#{orderRef}</span></p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Date: {createdDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} {createdDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
                                            Payment: <span className="font-bold">{displayPaymentMethod}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Customer Address & Billing Info */}
                                <div className="grid grid-cols-2 gap-6 py-4 border-b border-slate-200 text-xs">
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-[10px] text-slate-400 mb-1">Customer Details / Bill To:</p>
                                        <p className="font-black text-slate-900 text-sm">{address.name || 'Customer'}</p>
                                        <p className="text-slate-600 mt-0.5">{address.phone || '—'}</p>
                                        <p className="text-slate-500 mt-0.5 leading-relaxed">{address.address ? `${address.address}${address.city ? `, ${address.city}` : ''}` : 'Address not specified'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold uppercase tracking-wider text-[10px] text-slate-400 mb-1">Fulfilled By:</p>
                                        <p className="font-bold text-slate-800">{appName} Partner Hub</p>
                                        <p className="text-slate-500 mt-0.5">Express Doorstep Delivery</p>
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                                            <tr>
                                                <th className="px-3 py-2.5 text-center w-10">#</th>
                                                <th className="px-3 py-2.5">Item Description</th>
                                                <th className="px-3 py-2.5 text-center w-16">Qty</th>
                                                <th className="px-3 py-2.5 text-right w-24">Price</th>
                                                <th className="px-3 py-2.5 text-right w-24">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-800">
                                            {items.map((item, idx) => {
                                                const variantLabel = resolveOrderItemVariantLabel(item);
                                                const qty = item.quantity ?? item.qty ?? 1;
                                                const unitPrice = Number(item.price || 0);
                                                const itemTotal = unitPrice * qty;
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="px-3 py-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                        <td className="px-3 py-2.5 font-medium">
                                                            <span className="font-bold text-slate-900">{item.name}</span>
                                                            {variantLabel && (
                                                                <span className="block text-[10px] font-semibold text-slate-500">{variantLabel}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center font-bold">{qty}</td>
                                                        <td className="px-3 py-2.5 text-right text-slate-600">{formatInr(unitPrice)}</td>
                                                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">{formatInr(itemTotal)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Billing Summary Totals */}
                                <div className="mt-4 flex justify-end">
                                    <div className="w-full sm:w-72 space-y-1.5 text-xs">
                                        <div className="flex justify-between text-slate-600">
                                            <span>Items Subtotal</span>
                                            <span className="font-medium">{formatInr(subtotal)}</span>
                                        </div>
                                        {Number(deliveryFee) > 0 && (
                                            <div className="flex justify-between text-slate-600">
                                                <span>Delivery Charges</span>
                                                <span className="font-medium">{formatInr(deliveryFee)}</span>
                                            </div>
                                        )}
                                        {Number(platformFee) > 0 && (
                                            <div className="flex justify-between text-slate-600">
                                                <span>Platform Fee</span>
                                                <span className="font-medium">{formatInr(platformFee)}</span>
                                            </div>
                                        )}
                                        {Number(tax) > 0 && (
                                            <div className="flex justify-between text-slate-600">
                                                <span>GST / Taxes</span>
                                                <span className="font-medium">{formatInr(tax)}</span>
                                            </div>
                                        )}
                                        {Number(discount) > 0 && (
                                            <div className="flex justify-between text-emerald-600 font-medium">
                                                <span>Discount Applied</span>
                                                <span>-{formatInr(discount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t-2 border-slate-900">
                                            <span>Grand Total Paid</span>
                                            <span>{formatInr(grandTotal)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Invoice Footer Note */}
                                <div className="mt-6 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500">
                                    <p className="font-semibold text-slate-700">Thank you for ordering with {appName}!</p>
                                    <p className="mt-0.5">This is a computer-generated tax invoice and requires no physical signature.</p>
                                </div>
                            </div>

                            {/* Actions Toolbar (Screen Only) */}
                            <div className="no-print px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={handlePrint} 
                                    className="flex-1 py-3 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md hover:brightness-105 cursor-pointer" 
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    <Printer size={18} /> Print Bill
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handleSavePdf}
                                    className="flex-1 py-3 bg-white text-slate-800 border border-slate-200 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors shadow-sm cursor-pointer"
                                >
                                    <Download size={18} /> Save as PDF
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Print Stylesheet overrides */}
            <style>
                {`
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 10mm;
                        }
                        body > *:not(.customer-invoice-portal-root) {
                            display: none !important;
                        }
                        html, body {
                            background: #ffffff !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            height: auto !important;
                            overflow: visible !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .customer-invoice-portal-root {
                            display: block !important;
                            width: 100% !important;
                        }
                        .customer-invoice-backdrop {
                            position: static !important;
                            inset: auto !important;
                            background: transparent !important;
                            backdrop-filter: none !important;
                            padding: 0 !important;
                            display: block !important;
                            height: auto !important;
                        }
                        .customer-invoice-modal {
                            position: static !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            box-shadow: none !important;
                            border-radius: 0 !important;
                            border: none !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #ffffff !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                        .customer-printable-invoice {
                            position: static !important;
                            width: 100% !important;
                            padding: 0 !important;
                            margin: 0 !important;
                        }
                    }
                `}
            </style>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default InvoiceModal;
