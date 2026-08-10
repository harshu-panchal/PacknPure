import React, { useState, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import { RotateCcw, Save, ShieldAlert, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { adminApi } from '../services/adminApi';

const ReturnControl = () => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [enableReturns, setEnableReturns] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await adminApi.getPlatformSettings();
                if (res.data?.success && res.data.result) {
                    setEnableReturns(res.data.result.enableReturns ?? true);
                }
            } catch (error) {
                console.error('Failed to load settings', error);
                showToast('Failed to load settings', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [showToast]);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await adminApi.updatePlatformSettings({
                enableReturns,
            });
            showToast('Return settings updated successfully', 'success');
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
                        Return Control
                        <div className="p-2 bg-rose-100 rounded-xl">
                            <RotateCcw className="h-5 w-5 text-rose-600" />
                        </div>
                    </h1>
                    <p className="admin-description mt-1">Manage return visibility settings for customers on the mobile order page.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || loading}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95",
                            (isSaving || loading) ? "opacity-70 cursor-not-allowed" : "hover:bg-slate-800"
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
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="h-8 w-8 border-4 border-rose-600/30 border-t-rose-600 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Control Card */}
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-[32px] overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    <RotateCcw className="h-4 w-4 text-rose-500" />
                                    Customer Return Window Toggle
                                </h3>
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase",
                                    enableReturns 
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                        : "bg-rose-50 text-rose-700 border border-rose-100"
                                )}>
                                    {enableReturns ? "Returns Enabled" : "Returns Disabled"}
                                </span>
                            </div>
                            <div className="p-8 space-y-8">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-slate-50 rounded-[24px]">
                                    <div className="space-y-2 max-w-xl">
                                        <h4 className="text-sm font-black text-slate-800">Show Return Option to Customers</h4>
                                        <p className="text-xs font-bold text-slate-500 leading-relaxed">
                                            When enabled, customers can request returns on delivered items within their eligibility period. When disabled, the return option is hidden, preventing new return requests.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEnableReturns(!enableReturns)}
                                        className={cn(
                                            "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                            enableReturns ? "bg-rose-600" : "bg-slate-300"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                                enableReturns ? "translate-x-5" : "translate-x-0"
                                            )}
                                        />
                                    </button>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Mockup Preview Enabled */}
                                    <div className={cn(
                                        "border-2 rounded-[24px] p-6 space-y-4 transition-all relative overflow-hidden",
                                        enableReturns ? "border-emerald-200 bg-emerald-50/10" : "border-slate-100 opacity-60"
                                    )}>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            <CheckCircle size={14} className="text-emerald-500" />
                                            Preview: Returns Enabled
                                        </div>
                                        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
                                            <div className="h-3 w-1/3 bg-slate-100 rounded" />
                                            <div className="h-6 w-full bg-rose-600 text-white rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest">
                                                Request Return
                                            </div>
                                        </div>
                                        {enableReturns && (
                                            <div className="absolute top-2 right-2 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                                                Active State
                                            </div>
                                        )}
                                    </div>

                                    {/* Mockup Preview Disabled */}
                                    <div className={cn(
                                        "border-2 rounded-[24px] p-6 space-y-4 transition-all relative overflow-hidden",
                                        !enableReturns ? "border-rose-200 bg-rose-50/10" : "border-slate-100 opacity-60"
                                    )}>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            <ShieldAlert size={14} className="text-rose-500" />
                                            Preview: Returns Disabled
                                        </div>
                                        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
                                            <div className="h-3 w-1/3 bg-slate-100 rounded" />
                                            <div className="bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest border border-dashed border-slate-200 py-3">
                                                No Return Option (Hidden)
                                            </div>
                                        </div>
                                        {!enableReturns && (
                                            <div className="absolute top-2 right-2 text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                                                Active State
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReturnControl;
