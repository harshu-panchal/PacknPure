import React from 'react';
import { X, Printer, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@core/context/SettingsContext';
import { brandColor } from '../../constants/brandTheme';
import { resolveOrderItemVariantLabel } from '@/shared/utils/orderItemDisplay';

function formatInr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

const InvoiceModal = ({ isOpen, onClose, order }) => {
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    const primaryColor = brandColor(settings);
    if (!order) return null;

    const items = order.items || [];
    const pricing = order.pricing || order.bill || {};
    const address = order.address || {};
    const orderRef = order.orderId || order.id || '—';

    const subtotal =
      pricing.subtotal ??
      pricing.itemTotal ??
      items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || item.qty || 0), 0);
    const tax = pricing.gst ?? pricing.tax ?? 0;
    const grandTotal = pricing.total ?? pricing.grandTotal ?? subtotal + tax;

    const handlePrint = () => {
        window.print();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative"
                        >
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-slate-800">Invoice</h2>
                                    <p className="text-xs text-slate-500 font-medium">#{orderRef}</p>
                                </div>
                                <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-slate-200 transition-colors shadow-sm border border-slate-100">
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6" id="printable-invoice">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h1 className="text-2xl font-black tracking-tight" style={{ color: primaryColor }}>{appName}</h1>
                                        <p className="text-xs text-slate-500 mt-1">{settings?.companyName || 'Quick Commerce'}<br />{settings?.address || '—'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-800">Bill To:</p>
                                        <p className="text-xs text-slate-500 mt-1">{address.name}<br />{address.phone}</p>
                                    </div>
                                </div>

                                <div className="border rounded-xl overflow-hidden border-slate-100">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                            <tr>
                                                <th className="px-4 py-3">Item</th>
                                                <th className="px-4 py-3 text-right">Qty</th>
                                                <th className="px-4 py-3 text-right">Price</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {items.map((item, idx) => {
                                              const variantLabel = resolveOrderItemVariantLabel(item);
                                              const qty = item.quantity ?? item.qty ?? 1;
                                              return (
                                                <tr key={idx}>
                                                    <td className="px-4 py-3 text-slate-700 font-medium">
                                                      <span>{item.name}</span>
                                                      {variantLabel ? (
                                                        <span className="block text-[11px] font-semibold text-slate-500 mt-0.5">{variantLabel}</span>
                                                      ) : null}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500 text-right">{qty}</td>
                                                    <td className="px-4 py-3 text-slate-800 font-bold text-right">{formatInr(item.price)}</td>
                                                </tr>
                                              );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Subtotal</span>
                                        <span>{formatInr(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Tax</span>
                                        <span>{formatInr(tax)}</span>
                                    </div>
                                    <div className="flex justify-between text-base font-black text-slate-800 pt-2 border-t border-slate-100">
                                        <span>Total Paid</span>
                                        <span>{formatInr(grandTotal)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                                <button onClick={handlePrint} className="flex-1 py-3 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg" style={{ backgroundColor: primaryColor }}>
                                    <Printer size={18} /> Print
                                </button>
                                <button type="button" className="flex-1 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                                    <Download size={18} /> Save PDF
                                </button>
                            </div>

                            <style>
                                {`
                                    @media print {
                                        body * { visibility: hidden; }
                                        #printable-invoice, #printable-invoice * { visibility: visible; }
                                        #printable-invoice { position: absolute; left: 0; top: 0; width: 100%; }
                                    }
                                `}
                            </style>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default InvoiceModal;
