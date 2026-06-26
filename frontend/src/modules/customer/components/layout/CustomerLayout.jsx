import React from 'react';
import Header from './Header';
import Footer from './Footer';
import BottomNav from './BottomNav';
import MiniCart from '../shared/MiniCart';
import ProductDetailSheet from '../shared/ProductDetailSheet';
import { useProductDetail } from '../../context/ProductDetailContext';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

const CustomerLayout = ({ children, showHeader: showHeaderProp, fullHeight = false, showCart: showCartProp, showBottomNav: showBottomNavProp }) => {
    const location = useLocation();
    const { isOpen: isProductDetailOpen } = useProductDetail();

    // Route-based visibility logic
    const path = location.pathname.replace(/\/$/, '') || '/';

    const hideHeaderRoutes = ['/', '/categories', '/offers', '/orders', '/transactions', '/profile', '/profile/edit', '/wishlist', '/addresses', '/wallet', '/support', '/privacy', '/about', '/terms', '/checkout', '/cart', '/search', '/chat'];
    const hideBottomNavRoutes = ['/checkout', '/cart', '/search', '/chat'];
    const hideCartRoutes = ['/checkout', '/cart', '/search', '/chat'];

    // If props are passed, use them. Otherwise, use route-based logic.
    const showHeader = showHeaderProp !== undefined ? showHeaderProp : (!hideHeaderRoutes.includes(path) && !path.startsWith('/category') && !path.startsWith('/orders') && !path.startsWith('/product'));
    const showBottomNav = showBottomNavProp !== undefined ? showBottomNavProp : !hideBottomNavRoutes.includes(path);
    const showCart = showCartProp !== undefined ? showCartProp : (!hideCartRoutes.includes(path) && !path.startsWith('/orders'));

    // Hide elements on mobile only when product detail is open
    // On desktop, we want to keep the header visible even if the modal is open
    const finalShowHeaderMobile = showHeader && !isProductDetailOpen;
    const finalShowBottomNavMobile = showBottomNav && !isProductDetailOpen;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <Header showMobile={finalShowHeaderMobile} showDesktop={true} />

            <main className={cn("flex-1 md:pb-0", !showHeader && "pt-0", !fullHeight && "pb-16")}>
                {children}
            </main>

            {showCart && <MiniCart />}
            <ProductDetailSheet />

            <div className="hidden w-full md:block">
                <Footer />
            </div>

            {/* Bottom Nav logic */}
            <div className="md:hidden">
                {finalShowBottomNavMobile && <BottomNav />}
            </div>
            {/* Desktop Bottom Nav doesn't exist usually, but just in case of future changes */}
            <div className="hidden md:block">
                {showBottomNav && <BottomNav />}
            </div>
        </div>
    );
};

export default CustomerLayout;
