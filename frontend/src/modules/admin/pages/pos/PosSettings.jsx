import React, { useState } from 'react';
import { Settings, Printer, Percent, Shield, Zap } from 'lucide-react';
import { Button, Switch } from '@mui/material';
import { toast } from 'sonner';

export default function PosSettings() {
    const [settings, setSettings] = useState({
        enableGuestCheckout: true,
        enableSplitPayment: true,
        autoPrintReceipt: true,
        receiptSize: '80mm',
        discountLimit: 15,
        barcodeMode: 'auto',
        managerOverrideRefunds: true
    });
    
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            toast.success("POS Settings saved successfully");
            setIsSaving(false);
        }, 800);
    };

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="p-6 max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Settings className="mr-3 w-7 h-7 text-gray-600" />
                        POS Settings
                    </h1>
                    <p className="text-gray-500 mt-1">Configure offline terminal behaviors and permissions</p>
                </div>
                <Button 
                    variant="contained" 
                    color="primary" 
                    size="large"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="!font-bold !px-8"
                >
                    {isSaving ? "Saving..." : "Save Settings"}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Checkout & Operations */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center text-lg">
                        <Zap className="w-5 h-5 mr-2 text-yellow-500" /> Operations
                    </h3>
                    
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold text-gray-700">Enable Guest Checkout</div>
                                <div className="text-sm text-gray-500">Allow orders without customer phone number</div>
                            </div>
                            <Switch 
                                checked={settings.enableGuestCheckout} 
                                onChange={(e) => handleChange('enableGuestCheckout', e.target.checked)} 
                                color="primary" 
                            />
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold text-gray-700">Enable Split Payment</div>
                                <div className="text-sm text-gray-500">Allow combining Cash + UPI/Card</div>
                            </div>
                            <Switch 
                                checked={settings.enableSplitPayment} 
                                onChange={(e) => handleChange('enableSplitPayment', e.target.checked)} 
                                color="primary" 
                            />
                        </div>

                        <div>
                            <div className="font-semibold text-gray-700 mb-2">Barcode Scanner Mode</div>
                            <select 
                                value={settings.barcodeMode}
                                onChange={(e) => handleChange('barcodeMode', e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="auto">Auto-Submit (Instantly Add to Cart)</option>
                                <option value="manual">Manual (Require Enter Key)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Printing & Hardware */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center text-lg">
                        <Printer className="w-5 h-5 mr-2 text-indigo-500" /> Printing & Hardware
                    </h3>
                    
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold text-gray-700">Auto Print Receipt</div>
                                <div className="text-sm text-gray-500">Print receipt automatically on successful payment</div>
                            </div>
                            <Switch 
                                checked={settings.autoPrintReceipt} 
                                onChange={(e) => handleChange('autoPrintReceipt', e.target.checked)} 
                                color="primary" 
                            />
                        </div>
                        
                        <div>
                            <div className="font-semibold text-gray-700 mb-2">Thermal Printer Paper Size</div>
                            <div className="flex gap-4">
                                <label className={`flex-1 flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${settings.receiptSize === '58mm' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                    <input type="radio" name="receiptSize" value="58mm" checked={settings.receiptSize === '58mm'} onChange={(e) => handleChange('receiptSize', e.target.value)} className="hidden" />
                                    58mm
                                </label>
                                <label className={`flex-1 flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${settings.receiptSize === '80mm' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                    <input type="radio" name="receiptSize" value="80mm" checked={settings.receiptSize === '80mm'} onChange={(e) => handleChange('receiptSize', e.target.value)} className="hidden" />
                                    80mm
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security & Limits */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm md:col-span-2">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center text-lg">
                        <Shield className="w-5 h-5 mr-2 text-red-500" /> Security & Limits
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <div className="font-semibold text-gray-700 mb-2 flex items-center">
                                <Percent className="w-4 h-4 mr-1 text-gray-500" /> Max Manual Discount (%)
                            </div>
                            <p className="text-sm text-gray-500 mb-3">Maximum discount a cashier can apply without manager pin</p>
                            <input 
                                type="number" 
                                min="0" 
                                max="100" 
                                value={settings.discountLimit}
                                onChange={(e) => handleChange('discountLimit', Number(e.target.value))}
                                className="w-full p-2.5 border border-gray-300 rounded focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        <div className="flex items-center justify-between bg-red-50 p-4 rounded-lg border border-red-100 h-fit self-end">
                            <div>
                                <div className="font-bold text-red-900">Manager Override for Refunds</div>
                                <div className="text-sm text-red-700">Require admin PIN to process returns/voids</div>
                            </div>
                            <Switch 
                                checked={settings.managerOverrideRefunds} 
                                onChange={(e) => handleChange('managerOverrideRefunds', e.target.checked)} 
                                color="error" 
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
