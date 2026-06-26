import React from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { HiOutlineUsers, HiOutlineCheckBadge, HiOutlineClock, HiOutlineMapPin } from 'react-icons/hi2';

/**
 * Unified supplier navigation — filter tabs + seller locations link.
 * Pass `counts` on the suppliers page to show totals per tab.
 */
const SellerTabs = ({ counts = null }) => {
    const [searchParams] = useSearchParams();
    const tab = searchParams.get('tab') || 'all';

    const countFor = (matchTab) => {
        if (!counts) return null;
        if (matchTab === 'all') return counts.all;
        if (matchTab === 'verified') return counts.verified;
        if (matchTab === 'pending') return counts.pending;
        return null;
    };

    const tabs = [
        { label: 'All Suppliers', path: '/admin/suppliers', matchTab: 'all', icon: HiOutlineUsers },
        { label: 'Verified & Active', path: '/admin/suppliers?tab=verified', matchTab: 'verified', icon: HiOutlineCheckBadge },
        { label: 'Pending Review', path: '/admin/suppliers?tab=pending', matchTab: 'pending', icon: HiOutlineClock },
        { label: 'Seller Locations', path: '/admin/seller-locations', matchTab: null, icon: HiOutlineMapPin },
    ];

    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {tabs.map((item) => {
                const isSuppliersTab = item.path.startsWith('/admin/suppliers');
                const isActive = isSuppliersTab
                    ? (item.matchTab === 'all' ? tab === 'all' : tab === item.matchTab)
                    : undefined;
                const count = isSuppliersTab ? countFor(item.matchTab) : null;

                if (isSuppliersTab) {
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                                isActive
                                    ? "bg-indigo-600 text-white shadow-md"
                                    : "bg-white text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200",
                            )}
                        >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                            {count != null && (
                                <span className={cn(
                                    "min-w-[1.25rem] px-1.5 py-0.5 rounded-md text-[10px] font-black text-center",
                                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600",
                                )}>
                                    {count}
                                </span>
                            )}
                        </NavLink>
                    );
                }

                return (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive: routeActive }) => cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                            routeActive
                                ? "bg-indigo-600 text-white shadow-md"
                                : "bg-white text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200",
                        )}
                    >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                    </NavLink>
                );
            })}
        </div>
    );
};

export default SellerTabs;
