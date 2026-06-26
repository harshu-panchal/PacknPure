import React from 'react';
import { ClipboardList, ChevronRight } from 'lucide-react';

const HomeSetupBanner = ({ title, cta = 'Start', onClick }) => (
    <div className="fixed bottom-[70px] left-0 right-0 z-30 px-3 md:hidden pointer-events-none">
        <button
            type="button"
            onClick={onClick}
            className="pointer-events-auto w-full max-w-lg mx-auto flex items-center gap-3 bg-white rounded-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)] border border-slate-100 px-4 py-3.5"
        >
            <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <ClipboardList size={20} className="text-[#E23744]" />
            </div>
            <p className="flex-1 text-left text-sm font-semibold text-slate-800 leading-snug">
                {title}
            </p>
            <span className="shrink-0 inline-flex items-center gap-0.5 bg-[#E23744] text-white text-sm font-bold px-4 py-2 rounded-lg">
                {cta}
                <ChevronRight size={16} />
            </span>
        </button>
    </div>
);

export default HomeSetupBanner;
