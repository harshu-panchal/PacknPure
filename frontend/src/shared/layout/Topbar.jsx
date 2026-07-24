import React from 'react';
import { useAuth } from '@core/context/AuthContext';
import {
    HiOutlineLogout,
    HiOutlineBell,
    HiOutlineSearch,
    HiOutlineMenu
} from 'react-icons/hi';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { sellerApi } from '@/modules/seller/services/sellerApi';
import { adminApi } from '@/modules/admin/services/adminApi';
import { AnimatePresence } from 'framer-motion';
import NotificationPopup from './NotificationPopup';
import { toast } from 'sonner';

const Topbar = ({ onMenuClick, isMobileNavOpen = false }) => {
    const { user, logout, role } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [searchQuery, setSearchQuery] = React.useState('');
    const [showSearchSuggestions, setShowSearchSuggestions] = React.useState(false);
    const [notifications, setNotifications] = React.useState([]);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [showNotifications, setShowNotifications] = React.useState(false);
    const notificationRef = React.useRef(null);

    const isSeller = location.pathname.startsWith('/seller');
    const usesShellChrome = role === 'admin' || role === 'seller';

    const handleSearchSubmit = (e) => {
        if (e) e.preventDefault();
        const q = (searchQuery || '').trim();
        if (!q) return;

        if (isSeller) {
            const term = q.toLowerCase();
            if (term.includes('product')) return navigate('/seller/products');
            if (term.includes('stock') || term.includes('inventor')) return navigate('/seller/inventory');
            if (term.includes('customer') || term.includes('order') || term.includes('purchas') || term.includes('procure')) return navigate('/seller/procurement');
            if (term.includes('return')) return navigate('/seller/returns');
            if (term.includes('track') || term.includes('ship')) return navigate('/seller/tracking');
            if (term.includes('analytic') || term.includes('report')) return navigate('/seller/analytics');
            if (term.includes('withdraw')) return navigate('/seller/withdrawals');
            if (term.includes('transaction') || term.includes('payment')) return navigate('/seller/transactions');
            if (term.includes('earning')) return navigate('/seller/earnings');
            if (term.includes('profile')) return navigate('/seller/profile');

            navigate(`/seller/products?q=${encodeURIComponent(q)}`);
        } else if (role === 'admin') {
            const term = q.toLowerCase();
            if (term.includes('product')) return navigate('/admin/products');
            if (term.includes('vendor') || term.includes('seller') || term.includes('supplier')) return navigate('/admin/suppliers');
            if (term.includes('categor')) return navigate('/admin/categories/hierarchy');
            if (term.includes('customer') || term.includes('user')) return navigate('/admin/customers');
            if (term.includes('order')) return navigate('/admin/orders/all');
            if (term.includes('hub') || term.includes('inventor')) return navigate('/admin/hub-inventory');
            if (term.includes('deliver') || term.includes('driver')) return navigate('/admin/delivery-boys/active');
            if (term.includes('pickup')) return navigate('/admin/pickup-partners');
            
            // Fallback for general search
            navigate(`/admin/products?q=${encodeURIComponent(q)}`);
        }
    };

    const fetchNotifications = async () => {
        try {
            let response;
            if (isSeller) {
                response = await sellerApi.getNotifications();
            } else if (role === 'admin') {
                response = await adminApi.getNotifications();
            } else {
                return; // Only sellers and admins have notifications
            }

            if (response?.data?.success) {
                setNotifications(response.data.result.notifications);
                setUnreadCount(response.data.result.unreadCount);
            }
        } catch (error) {
            console.error("Notif Fetch Error:", error);
        }
    };

    const handleToggleNotifications = () => {
        const willOpen = !showNotifications;
        setShowNotifications(willOpen);
        if (willOpen) {
            fetchNotifications();
        }
    };

    // Handle Click Outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = async (id) => {
        try {
            if (isSeller) {
                await sellerApi.markNotificationRead(id);
            } else if (role === 'admin') {
                await adminApi.markNotificationRead(id);
            }
            fetchNotifications();
        } catch {
            toast.error("Failed to mark as read");
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            if (isSeller) {
                await sellerApi.markAllNotificationsRead();
            } else if (role === 'admin') {
                await adminApi.markAllNotificationsRead();
            }
            fetchNotifications();
            toast.success("All caught up!");
        } catch {
            toast.error("Failed to mark all as read");
        }
    };

    const handleLogout = () => {
        logout();
    };

    const adminSearchOptions = React.useMemo(() => [
        { label: "Products Management", path: "/admin/products" },
        { label: "Suppliers", path: "/admin/suppliers" },
        { label: "Pending Sellers", path: "/admin/sellers/pending" },
        { label: "Category Hierarchy", path: "/admin/categories/hierarchy" },
        { label: "Customer Management", path: "/admin/customers" },
        { label: "All Orders", path: "/admin/orders/all" },
        { label: "Hub Inventory", path: "/admin/hub-inventory" },
        { label: "Active Delivery Drivers", path: "/admin/delivery-boys/active" },
        { label: "Pickup Partners", path: "/admin/pickup-partners" },
        { label: "Admin Settings", path: "/admin/settings" },
        { label: "Wallet & Funds", path: "/admin/wallet" },
        { label: "Coupons & Promos", path: "/admin/coupons" },
    ], []);

    const sellerSearchOptions = React.useMemo(() => [
        { label: "Products Management", path: "/seller/products" },
        { label: "Stock & Inventory", path: "/seller/inventory" },
        { label: "Purchase Orders", path: "/seller/procurement" },
        { label: "Returns Management", path: "/seller/returns" },
        { label: "Track Shipments", path: "/seller/tracking" },
        { label: "Sales Reports & Analytics", path: "/seller/analytics" },
        { label: "Withdrawals", path: "/seller/withdrawals" },
        { label: "Payment History", path: "/seller/transactions" },
        { label: "Earnings", path: "/seller/earnings" },
        { label: "Store Profile", path: "/seller/profile" },
    ], []);

    const filteredOptions = React.useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        if (role === 'admin') {
            return adminSearchOptions.filter(opt => opt.label.toLowerCase().includes(query));
        } else if (isSeller) {
            return sellerSearchOptions.filter(opt => opt.label.toLowerCase().includes(query));
        }
        return [];
    }, [searchQuery, role, isSeller, adminSearchOptions, sellerSearchOptions]);

    return (
        <header
            className={cn(
                "bg-white/90 backdrop-blur-xl border-b border-gray-100/50 flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all duration-300 gap-2",
                usesShellChrome
                    ? "sticky top-0 z-shell-topbar h-[calc(var(--shell-header-h)+var(--safe-top))] pt-[var(--safe-top)] px-3 sm:px-4 md:h-16 md:pt-0 md:px-6"
                    : "fixed top-0 left-0 right-0 md:left-56 h-[calc(var(--shell-header-h-md)+var(--safe-top))] pt-[var(--safe-top)] px-4 md:px-6 md:pt-0 md:h-16 z-shell-topbar"
            )}
        >
            <div className="flex items-center flex-1 min-w-0 mr-1 sm:mr-3 overflow-visible">
                <button
                    type="button"
                    onClick={onMenuClick}
                    aria-label={isMobileNavOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={isMobileNavOpen}
                    aria-controls="app-sidebar"
                    className="touch-target inline-flex items-center justify-center mr-1 sm:mr-2 bg-gray-100/80 hover:bg-white rounded-xl text-gray-600 hover:text-primary transition-all duration-300 border border-transparent hover:border-primary/20 shadow-sm flex-shrink-0"
                >
                    <HiOutlineMenu className="h-5 w-5" />
                </button>

                <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0 max-w-full md:max-w-[400px] group">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-all duration-300 pointer-events-none" />
                    <input
                        type="search"
                        placeholder={isSeller ? "Search products..." : "Search..."}
                        aria-label="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setShowSearchSuggestions(true)}
                        onBlur={() => setShowSearchSuggestions(false)}
                        className="w-full min-w-0 pl-10 pr-3 sm:pr-4 py-2 bg-gray-100/50 border border-transparent rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/20 transition-all duration-500 outline-none"
                    />
                    
                    {(role === 'admin' || isSeller) && showSearchSuggestions && searchQuery.trim() && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden z-shell-dropdown animate-in fade-in slide-in-from-top-2">
                            {filteredOptions.length > 0 ? (
                                <ul className="max-h-64 overflow-y-auto py-1">
                                    {filteredOptions.map((opt, i) => (
                                        <li key={i}>
                                            <button
                                                type="button"
                                                onMouseDown={(e) => {
                                                    e.preventDefault(); // Prevents input blur
                                                    navigate(opt.path);
                                                    setSearchQuery(opt.label);
                                                    setShowSearchSuggestions(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors flex items-center space-x-2 min-h-11"
                                            >
                                                <HiOutlineSearch className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                                <span className="truncate">{opt.label}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="px-4 py-3 text-xs text-gray-500 font-medium bg-gray-50/50">
                                    No exact module found. Press <span className="font-bold text-gray-700">Enter</span> to search all products.
                                </div>
                            )}
                        </div>
                    )}
                </form>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
                <div className="relative" ref={notificationRef}>
                    <button
                        type="button"
                        onClick={handleToggleNotifications}
                        aria-label="Notifications"
                        aria-expanded={showNotifications}
                        className={cn(
                            "touch-target inline-flex items-center justify-center hover:bg-primary/5 text-gray-500 hover:text-primary rounded-xl transition-all duration-300 relative group",
                            showNotifications && "bg-primary/5 text-primary"
                        )}
                    >
                        <HiOutlineBell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 h-2 w-2 bg-rose-500 rounded-full ring-2 ring-white shadow-sm"></span>
                        )}
                    </button>

                    <AnimatePresence>
                        {showNotifications && (
                            <NotificationPopup
                                notifications={notifications}
                                onMarkAsRead={handleMarkAsRead}
                                onMarkAllAsRead={handleMarkAllAsRead}
                                onClose={() => setShowNotifications(false)}
                            />
                        )}
                    </AnimatePresence>
                </div>

                <div className="hidden sm:block h-8 w-px bg-gray-100 mx-0.5" aria-hidden />

                <button
                    type="button"
                    aria-label="Open profile"
                    onClick={() => {
                        if (location.pathname.startsWith('/admin')) {
                            navigate('/admin/profile');
                        } else if (location.pathname.startsWith('/seller')) {
                            navigate('/seller/profile');
                        } else if (location.pathname.startsWith('/delivery')) {
                            navigate('/delivery/profile');
                        } else {
                            navigate('/profile');
                        }
                    }}
                    className="flex items-center space-x-2.5 p-1 md:pr-3 hover:bg-gray-50 rounded-xl transition-all duration-300 group ring-1 ring-transparent hover:ring-gray-100 shadow-sm hover:shadow-md min-h-11"
                >
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform flex-shrink-0">
                        {user?.name?.[0] || 'A'}
                    </div>
                    <div className="hidden md:block text-left min-w-0">
                        <p className="text-xs font-bold text-gray-900 leading-tight truncate max-w-[9rem]">{user?.name || 'Demo User'}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider truncate">{user?.role || 'Member'}</p>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Sign out"
                    className="touch-target inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-300 font-bold text-xs shadow-sm hover:shadow-rose-100/50"
                >
                    <HiOutlineLogout className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden lg:inline">Sign Out</span>
                </button>
            </div>
        </header>
    );
};

export default Topbar;
