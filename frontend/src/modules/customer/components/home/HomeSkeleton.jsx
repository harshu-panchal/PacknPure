import React from 'react';
import { HOME_SECTION } from './homeLayout';

const HomeSkeleton = () => {
    return (
        <div className="w-full animate-pulse pb-8">
            {/* Hero Banner Skeleton */}
            <div className="w-full h-[188px] md:h-[280px] lg:h-[360px] bg-slate-200"></div>

            {/* Category Skeleton */}
            <div className={`${HOME_SECTION} py-6 md:py-8`}>
                <div className="w-48 h-6 bg-slate-200 rounded-lg mb-6"></div>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-4 gap-y-6">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-slate-200 rounded-2xl"></div>
                            <div className="w-16 h-3 bg-slate-200 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Promo Banner Skeleton */}
            <div className={`${HOME_SECTION} py-2 mb-6`}>
                <div className="w-full h-[120px] md:h-[200px] bg-slate-200 rounded-2xl"></div>
            </div>

            {/* Products Skeleton */}
            <div className={`${HOME_SECTION} py-2`}>
                <div className="w-48 h-6 bg-slate-200 rounded-lg mb-6"></div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-full h-[240px] bg-slate-200 rounded-2xl"></div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HomeSkeleton;
