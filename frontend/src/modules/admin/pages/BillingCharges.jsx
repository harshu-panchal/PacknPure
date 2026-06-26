// Premium Logistics & Returns Configuration
import React, { useState, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import {
    RotateCcw,
    Save,
    Info,
    Truck,
    Settings,
    History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { adminApi } from '../services/adminApi';

const BillingCharges = () => {
    const { showToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [returnDeliveryCommission, setReturnDeliveryCommission] = useState(0);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await adminApi.getPlatformSettings();
                if (res.data?.success && res.data.result) {
                    setReturnDeliveryCommission(res.data.result.returnDeliveryCommission ?? 0);
                }
            } catch (error) {
                console.error('Failed to load platform settings', error);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await adminApi.updatePlatformSettings({
                returnDeliveryCommission,
            });
            showToast('Logistics settings updated successfully', 'success');
        } catch (error) {
            console.error('Failed to update settings', error);
            showToast('Failed to update settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="admin-h1 flex items-center gap-3">
                        Logistics & Returns
                        <div className="p-2 bg-rose-100 rounded-xl">
                            <RotateCcw className="h-5 w-5 text-rose-600" />
                        </div>
                    </h1>
                    <p className="admin-description mt-1">Configure seller return commissions and reverse logistics fees.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                        <History className="h-4 w-4 text-slate-400" />
                        AUDIT LOGS
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95",
                            isSaving ? "opacity-70 cursor-wait" : "hover:bg-slate-800"
                        )}
                    >
                        {isSaving ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>


            <div className="max-w-4xl mx-auto text-left">
                <div className="space-y-8">
                    {/* Notice Card */}
                    <div className="p-6 bg-amber-50 border border-amber-100 rounded-[32px] flex gap-4">
                        <Info className="h-6 w-6 text-amber-500 shrink-0" />
                        <div className="space-y-1">
                            <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Configuration Split</p>
                            <p className="text-xs font-bold text-amber-700/80 leading-relaxed">
                                Platform fees, delivery charges, and hub location settings have been moved to the <span className="font-black underline">Hub Settings</span> page for better operational focus.
                            </p>
                        </div>
                    </div>

                    {/* Reverse Logistics Settings */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-[32px] overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                <Truck className="h-4 w-4 text-rose-500" />
                                Reverse Logistics
                            </h3>
                        </div>
                        <div className="p-8">
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        Return Delivery Commission (per pickup)
                                        <Info className="h-3 w-3 opacity-50" />
                                    </label>
                                    <div className="relative group max-w-md">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-300 group-focus-within:text-slate-900 transition-colors">₹</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={returnDeliveryCommission}
                                            onChange={(e) =>
                                                setReturnDeliveryCommission(Number(e.target.value) || 0)
                                            }
                                            className="w-full pl-10 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-base font-black text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/10 transition-all"
                                        />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 italic">
                                        Flat amount paid to delivery partner for each approved return pickup (deducted from seller earnings).
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Support Settings */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-[32px] overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                <Settings className="h-4 w-4 text-slate-400" />
                                Administrative Overrides
                            </h3>
                        </div>
                        <div className="p-8">
                            <p className="text-xs font-bold text-slate-400 italic">
                                Additional logistics overrides and regional multipliers will appear here in future updates.
                            </p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default BillingCharges;
