import React, { useEffect, useState } from 'react';
import { ChevronLeft, Truck, Heart, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '@core/context/SettingsContext';
import { customerApi } from '../services/customerApi';

const AboutPage = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    const [pageContent, setPageContent] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        customerApi.getDynamicPage('about').then(res => {
            setPageContent(res.data.result || res.data);
            setIsLoading(false);
        }).catch(err => {
            console.error(err);
            setIsLoading(false);
        });
    }, []);
    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24">
            <main className="px-4 pt-4 max-w-3xl mx-auto space-y-4">
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
                            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">About Us</h1>
                        </div>
                    </div>
                </div>

                {/* Hero Section */}
                <div className="rounded-xl p-5 text-center bg-white border border-slate-200">
                    <div className="flex flex-col items-center">
                        <div className="bg-slate-100 p-3 rounded-lg mb-3">
                            <ShoppingBag size={24} className="text-slate-700" />
                        </div>
                        <h2 className="text-xl font-semibold mb-1 tracking-tight text-slate-900">{appName}</h2>
                        <p className="text-slate-600 text-sm max-w-sm mx-auto">Delivering happiness to your doorstep in minutes.</p>
                    </div>
                </div>

                {/* Dynamic Content */}
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="prose prose-slate prose-sm max-w-none text-slate-600">
                        {isLoading ? (
                            <div className="animate-pulse space-y-3">
                                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                                <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                            </div>
                        ) : pageContent ? (
                            <div dangerouslySetInnerHTML={{ __html: pageContent.content }} />
                        ) : (
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                                        <Truck size={18} />
                                    </div>
                                    <h3 className="text-base font-semibold text-slate-800">Our Mission</h3>
                                </div>
                                <p className="text-slate-600 leading-relaxed text-sm mb-6">
                                    To revolutionize quick commerce by providing the fastest, most reliable delivery of daily essentials, ensuring quality and convenience for every household.
                                </p>
                                
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                                        <Heart size={18} />
                                    </div>
                                    <h3 className="text-base font-semibold text-slate-800">Our Values</h3>
                                </div>
                                <ul className="space-y-3 text-sm text-slate-600">
                                    <li className="flex gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
                                        <span><strong>Customer First:</strong> Your satisfaction is our top priority.</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
                                        <span><strong>Quality Assurance:</strong> We deliver only the freshest and best products.</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
                                        <span><strong>Speed with Safety:</strong> Fast delivery without compromising on safety standards.</span>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                <div className="text-center pt-2">
                    <p className="text-xs text-slate-400">© {new Date().getFullYear()} {appName}. All rights reserved.</p>
                </div>

            </main>
        </div>
    );
};

export default AboutPage;
