import React from 'react';
import { usePosCart } from '../../context/PosCartContext';
import { Minus, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const PosCart = () => {
    const { cart, updateQuantity, removeItem } = usePosCart();

    if (cart.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-lg border-2 border-dashed border-gray-200 p-8">
                <p className="text-lg">Cart is empty</p>
                <p className="text-sm">Scan a barcode or search to add products</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto bg-white rounded-lg border border-gray-200">
            <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="py-3 px-4 text-sm font-semibold text-gray-600 min-w-[200px]">Product & Inventory Status</th>
                        <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-center w-32 min-w-[120px]">Qty</th>
                        <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-right w-24 min-w-[100px]">Unit Price</th>
                        <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-right w-24 min-w-[100px]">Total Price</th>
                        <th className="py-3 px-4 w-12"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {cart.map((item, index) => {
                        const hubAvailable = item.maxQty || 0; // maxQty stores Hub Available from search results
                        const isShortage = item.quantity > hubAvailable;

                        return (
                            <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                                <td className="py-3 px-4">
                                    <div className="font-medium text-gray-900">{item.name}</div>
                                    {item.variantName && (
                                        <div className="text-xs text-gray-500 mt-0.5 mb-2">{item.variantName}</div>
                                    )}
                                    
                                    {/* PacknPure Specific: Inventory Validation Indicator */}
                                    <div className="flex flex-col gap-1 mt-1">
                                        <div className="text-[11px] text-gray-500 flex flex-wrap items-center gap-2">
                                            <span>Hub Stock: <strong className="text-gray-700">{hubAvailable}</strong></span>
                                            <span>| Seller Stock: <strong className="text-gray-700">{item.productData?.sellerQty || 'N/A'}</strong></span>
                                            {isShortage ? (
                                                <span className="flex items-center text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 font-semibold">
                                                    <AlertTriangle className="w-3 h-3 mr-1" /> Only {hubAvailable} available at Hub. Procurement will be triggered.
                                                </span>
                                            ) : (
                                                <span className="flex items-center text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 font-semibold">
                                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Available in Hub
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 px-4">
                                    <div className="flex items-center justify-center border border-gray-200 rounded-md bg-white overflow-hidden shadow-sm">
                                        <button 
                                            onClick={() => updateQuantity(index, -1, Infinity)}
                                            className="p-1.5 hover:bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="w-10 text-center font-bold text-gray-800 text-sm">
                                            {item.quantity}
                                        </span>
                                        <button 
                                            // We remove the hard maxQty block so the cashier CAN ring up an item 
                                            // that triggers procurement backend orchestration
                                            onClick={() => updateQuantity(index, 1, Infinity)}
                                            className="p-1.5 hover:bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <div className="text-sm font-bold text-gray-900">₹{item.price.toFixed(2)}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">
                                        {item.productData?.gstEnabled ? `Inc. ${item.productData?.gstRate || 0}% GST` : 'No GST'}
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <div className="text-base font-black text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <button 
                                        onClick={() => removeItem(index)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        title="Remove item"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
