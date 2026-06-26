import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { useToast } from '@shared/components/ui/Toast';

const RequestProductPage = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        productName: '',
        description: '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.productName.trim()) {
            showToast('Please enter a product name', 'error');
            return;
        }

        setIsLoading(true);
        try {
            await customerApi.createProductRequest({
                productName: formData.productName.trim(),
                description: formData.description.trim() || undefined,
            });
            showToast('Product requested successfully!', 'success');
            navigate('/profile', { replace: true });
        } catch (error) {
            const msg = error.response?.data?.message || error.message || 'Failed to submit request';
            showToast(msg, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-10">
            <main className="max-w-2xl mx-auto px-4 pt-4 space-y-6 relative z-20">
                {/* Header */}
                <div className="mb-2">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="shrink-0 rounded-full p-1.5 hover:bg-slate-200/70 transition-colors -ml-1.5"
                            aria-label="Back"
                        >
                            <ChevronLeft size={22} className="text-slate-900" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Request a product</h1>
                        </div>
                    </div>
                </div>

                <div className="px-1 space-y-1">
                    <p className="text-[15px] font-medium text-slate-600 leading-relaxed">
                        Tell us if you can't find a product and we will add it to the shop as soon as possible.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-6 mt-4">
                        <div className="flex items-center gap-3 bg-white px-4 py-3.5 rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all shadow-sm">
                            <input
                                type="text"
                                name="productName"
                                value={formData.productName}
                                onChange={handleChange}
                                className="bg-transparent w-full text-slate-800 font-semibold outline-none placeholder:font-medium placeholder:text-slate-400 text-sm"
                                placeholder="Enter product name"
                                disabled={isLoading}
                                maxLength={100}
                                required
                            />
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <p className="text-sm font-semibold text-slate-800">Tell us more about the product <span className="text-slate-400 font-medium">(optional)</span></p>
                            </div>
                            <div className="bg-white px-4 py-3.5 rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all shadow-sm">
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={4}
                                    className="bg-transparent w-full text-slate-800 font-medium outline-none placeholder:text-slate-400 text-sm resize-none"
                                    placeholder="Add brand name, pack size, price..."
                                    disabled={isLoading}
                                    maxLength={500}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !formData.productName.trim()}
                        className="w-full mt-8 py-3.5 bg-[#E23744] text-white font-bold text-[15px] rounded-xl shadow-lg shadow-[#E23744]/20 hover:bg-[#C41E35] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Submit Request'
                        )}
                    </button>
                </form>
            </main>
        </div>
    );
};

export default RequestProductPage;
