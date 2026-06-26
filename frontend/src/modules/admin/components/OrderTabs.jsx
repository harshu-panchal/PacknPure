import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
    List, 
    Clock, 
    Package, 
    Truck, 
    CheckCircle2, 
    XCircle, 
    CornerUpLeft 
} from 'lucide-react';

const OrderTabs = () => {
    const tabs = [
        { label: 'All Orders', path: '/admin/orders/all', icon: List },

        { label: 'Being Prepared', path: '/admin/orders/processed', icon: Package },
        { label: 'On the Way', path: '/admin/orders/out-for-delivery', icon: Truck },
        { label: 'Delivered', path: '/admin/orders/delivered', icon: CheckCircle2 },
        { label: 'Cancelled', path: '/admin/orders/cancelled', icon: XCircle },
        { label: 'Returned', path: '/admin/orders/returned', icon: CornerUpLeft },
    ];

    return (
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4 overflow-x-auto">
            {tabs.map((tab) => (
                <NavLink
                    key={tab.path}
                    to={tab.path}
                    className={({ isActive }) => cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                        isActive
                            ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                            : "bg-white text-slate-500 hover:bg-slate-50 ring-1 ring-slate-200"
                    )}
                >
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                </NavLink>
            ))}
        </div>
    );
};

export default OrderTabs;
