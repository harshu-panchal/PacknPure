import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Store, Heart, Wallet, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { label: 'Shop', icon: Store, path: '/' },
    { label: 'My list', icon: Heart, path: '/wishlist' },
    { label: 'Wallet', icon: Wallet, path: '/wallet' },
    { label: 'Orders', icon: ShoppingBag, path: '/orders' },
    { label: 'Account', icon: User, path: '/profile' },
];

const BottomNav = () => {
    const location = useLocation();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[500] bg-white border-t border-slate-100 flex items-stretch justify-around min-h-[64px] md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
            {navItems.map((item) => {
                const isActive =
                    location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                            'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-0',
                            isActive ? 'text-[#E23744]' : 'text-slate-500',
                        )}
                    >
                        <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                        <span
                            className={cn(
                                'text-[10px] font-semibold truncate max-w-full px-1',
                                isActive && 'font-bold',
                            )}
                        >
                            {item.label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
};

export default BottomNav;
