import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { useAuth } from '@core/context/AuthContext';
import { cn } from '@/lib/utils';
import SellerEarningsContext, { defaultEarnings } from '@/modules/seller/context/SellerEarningsContext';
import { useSellerDashboard } from '@/modules/seller/hooks/useSellerDashboard';
import { useAdminOrderNotifications } from '@/modules/admin/hooks/useAdminOrderNotifications';

const MD_QUERY = '(min-width: 768px)';

const DashboardLayout = ({ children, navItems, title }) => {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MD_QUERY).matches : true,
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' ? !window.matchMedia(MD_QUERY).matches : false,
  );
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [routePath, setRoutePath] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '',
  );

  const { user, role } = useAuth();
  const location = useLocation();

  const isSeller = role === 'seller';
  const isAdmin = role === 'admin';
  const hasBottomNav = isAdmin || isSeller;

  const sellerDashboard = useSellerDashboard(isSeller);
  useAdminOrderNotifications(isAdmin);

  // Close mobile drawer when the route changes (render-time sync; avoids effect setState).
  if (location.pathname !== routePath) {
    setRoutePath(location.pathname);
    if (isMobileNavOpen) {
      setIsMobileNavOpen(false);
    }
    if (!isDesktop && !isSidebarCollapsed) {
      setIsSidebarCollapsed(true);
    }
  }

  useEffect(() => {
    const media = window.matchMedia(MD_QUERY);
    const onChange = (event) => {
      setIsDesktop(event.matches);
      if (event.matches) {
        setIsMobileNavOpen(false);
      } else {
        setIsSidebarCollapsed(true);
        setIsMobileNavOpen(false);
      }
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMobileNavOpen]);

  const handleMenuClick = useCallback(() => {
    if (isDesktop) {
      setIsSidebarCollapsed((prev) => !prev);
      return;
    }
    setIsMobileNavOpen((prev) => !prev);
  }, [isDesktop]);

  const handleMobileNavClose = useCallback(() => {
    setIsMobileNavOpen(false);
  }, []);

  const earningsContextValue = useMemo(
    () =>
      isSeller
        ? {
            earningsData: sellerDashboard.sellerEarningsData,
            earningsLoading: sellerDashboard.earningsLoading,
            refreshEarnings: sellerDashboard.refreshEarnings,
          }
        : {
            earningsData: defaultEarnings,
            earningsLoading: false,
            refreshEarnings: () => {},
          },
    [
      isSeller,
      sellerDashboard.sellerEarningsData,
      sellerDashboard.earningsLoading,
      sellerDashboard.refreshEarnings,
    ],
  );

  const contentOffsetClass = isDesktop
    ? isSidebarCollapsed
      ? 'pl-20'
      : isAdmin
        ? 'pl-64 md:pl-72'
        : 'pl-56 md:pl-64'
    : 'pl-0';

  return (
    <motion.div className="app-shell mesh-gradient-light">
      <motion.div
        className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none"
        aria-hidden
      />
      <motion.div
        className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none"
        style={{ animationDelay: '2s' }}
        aria-hidden
      />

      <Sidebar
        items={navItems}
        title={title}
        isCollapsed={isSidebarCollapsed}
        isDesktop={isDesktop}
        isMobileOpen={isMobileNavOpen}
        onClose={handleMobileNavClose}
      />

      <motion.div className={cn('app-shell-content', contentOffsetClass)}>
        <Topbar onMenuClick={handleMenuClick} isMobileNavOpen={isMobileNavOpen} />
        <motion.main
          className={cn(
            'app-main',
            !hasBottomNav && 'app-main--no-bottom-nav',
          )}
        >
          <motion.div className="app-page-container pb-4 md:pb-8">
            {isSeller && user && !user.isVerified && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 text-amber-800 shadow-sm"
              >
                <motion.div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-amber-600" />
                </motion.div>
                <motion.div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm md:text-base">Account Pending Approval</h4>
                  <p className="text-xs md:text-sm opacity-90">
                    Your account is currently being reviewed by our team. You can explore the
                    panel, but you cannot add products or fulfill purchase orders until verified.
                  </p>
                </motion.div>
                <motion.div className="hidden md:block flex-shrink-0">
                  <span className="px-3 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wider">
                    Under Review
                  </span>
                </motion.div>
              </motion.div>
            )}

            <SellerEarningsContext.Provider value={earningsContextValue}>
              {children}
            </SellerEarningsContext.Provider>
          </motion.div>
        </motion.main>
      </motion.div>

      {hasBottomNav && <BottomNav />}
    </motion.div>
  );
};

export default DashboardLayout;
