import React, { useState } from 'react';
import { usePosCart } from '../../context/PosCartContext';
import { Receipt, Tag, ArrowRight } from 'lucide-react';
import { Button } from '@mui/material';

export const SummaryPanel = ({ onCheckoutClick }) => {
    const { cart, cartTotals, manualDiscount, setManualDiscount } = usePosCart();
    const [showDiscountInput, setShowDiscountInput] = useState(false);
    const [tempDiscount, setTempDiscount] = useState(manualDiscount.amount);

    const applyDiscount = () => {
        setManualDiscount(prev => ({ ...prev, amount: Number(tempDiscount) || 0 }));
        setShowDiscountInput(false);
    };

    return (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center">
                <Receipt className="w-4 h-4 mr-2" />
                Order Summary
            </h3>

            <div className="space-y-3">
                <div className="flex justify-between text-sm text-gray-600">
                    <span>Base Price (Subtotal)</span>
                    <span className="font-medium text-gray-800">₹{cartTotals.subtotal}</span>
                </div>
                
                <div className="flex justify-between text-sm text-gray-600 border-b border-gray-200 pb-3">
                    <span>GST</span>
                    <span>₹{cartTotals.totalGst}</span>
                </div>

                <div className="flex flex-col pt-1">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 flex items-center">
                            Discount
                            <button 
                                onClick={() => setShowDiscountInput(!showDiscountInput)}
                                className="ml-2 text-blue-500 hover:text-blue-700"
                            >
                                <Tag className="w-3 h-3" />
                            </button>
                        </span>
                        <span className="font-medium text-red-500">- ₹{cartTotals.discount}</span>
                    </div>
                    
                    {showDiscountInput && (
                        <div className="flex mt-2 items-center space-x-2">
                            <input 
                                type="number" 
                                min="0"
                                max={cartTotals.subtotal}
                                value={tempDiscount}
                                onChange={(e) => setTempDiscount(e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded"
                                placeholder="Amount"
                            />
                            <button 
                                onClick={applyDiscount}
                                className="px-3 py-1 bg-gray-800 text-white text-xs rounded hover:bg-gray-700"
                            >
                                Apply
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-300">
                {/* Admin Insights: Margin & Cost */}
                {cartTotals.totalMargin !== undefined && (
                    <div className="mb-4 bg-blue-50 p-3 rounded-md border border-blue-100 flex justify-between items-center text-xs">
                        <div className="flex flex-col">
                            <span className="text-blue-700 font-semibold">Admin Insights</span>
                            <span className="text-blue-600">Total Vendor Cost: ₹{cartTotals.totalVendorCost}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-blue-600">Gross Margin</span>
                            <span className="text-blue-800 font-bold text-sm">₹{cartTotals.totalMargin}</span>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-end mb-6">
                    <span className="text-gray-800 font-bold">Grand Total</span>
                    <span className="text-3xl font-black text-blue-600">₹{cartTotals.total}</span>
                </div>

                <Button 
                    variant="contained" 
                    color="primary" 
                    fullWidth 
                    size="large"
                    disabled={cart.length === 0}
                    onClick={onCheckoutClick}
                    className="!py-3 !text-lg !font-bold flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
                    sx={{ borderRadius: '8px' }}
                >
                    Checkout (F4)
                    <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
            </div>
        </div>
    );
};
