import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    ClipboardList,
    Box,
    Wallet,
} from 'lucide-react';

/** Primary mobile bottom navigation for seller/admin shell. */
const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Path-based (not auth role) so panel nav never flips mid-tap on mobile
    const isAdminPanel = location.pathname.startsWith('/admin');

    const primaryItems = isAdminPanel ? [
        { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true },
        { label: 'Orders', path: '/admin/orders/all', icon: ClipboardList },
        { label: 'Products', path: '/admin/products', icon: Box },
        { label: 'Wallet', path: '/admin/wallet', icon: Wallet },
    ] : [
        { label: 'Dashboard', path: '/seller', icon: LayoutDashboard, end: true },
        { label: 'Orders', path: '/seller/procurement', icon: ClipboardList },
        { label: 'Products', path: '/seller/products', icon: Box },
        { label: 'Earnings', path: '/seller/earnings', icon: Wallet },
    ];

    const isItemActive = (item) => {
        if (item.end) {
            return location.pathname === item.path;
        }
        return (
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`)
        );
    };

    const goTo = (path) => {
        if (location.pathname === path) return;
        navigate(path);
    };

    return (
        <nav
            aria-label="Primary"
            className="fixed bottom-0 left-0 right-0 z-shell-bottom-nav md:hidden bg-[#0a0c10] border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.4)]"
            style={{
                paddingBottom: 'var(--safe-bottom)',
                paddingLeft: 'var(--safe-left)',
                paddingRight: 'var(--safe-right)',
                minHeight: 'calc(var(--shell-bottom-nav-h) + var(--safe-bottom))',
            }}
        >
            <div className="h-16 px-1 sm:px-2 flex items-stretch justify-around">
                {primaryItems.map((item) => {
                    const active = isItemActive(item);
                    return (
                        <button
                            key={item.path}
                            type="button"
                            aria-label={item.label}
                            aria-current={active ? 'page' : undefined}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                goTo(item.path);
                            }}
                            className={cn(
                                "flex flex-1 flex-col items-center justify-center gap-1 min-w-0 max-w-[5.5rem] px-1 transition-all duration-300 touch-manipulation relative z-10",
                                active ? "text-primary" : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden />
                            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight truncate max-w-full leading-none">
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
