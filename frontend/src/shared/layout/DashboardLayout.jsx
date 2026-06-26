import React, { useState, useEffect, useMemo } from 'react';
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

const DashboardLayout = ({ children, navItems, title }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 768);
  const { user, role } = useAuth();
  const location = useLocation();

  const isSeller = role === 'seller';
  const isAdmin = role === 'admin';

  const sellerDashboard = useSellerDashboard(isSeller);
  useAdminOrderNotifications(isAdmin);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  }, [location.pathname]);

  const handleMenuClick = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

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

  return (
    <motion.div className="min-h-screen mesh-gradient-light relative overflow-x-hidden">
      <motion.div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none" aria-hidden />
      <motion.div
        className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none"
        style={{ animationDelay: '2s' }}
        aria-hidden
      />

      <Sidebar
        items={navItems}
        title={title}
        isCollapsed={isSidebarCollapsed}
      />

      <motion.div
        className={cn(
          'transition-all duration-300 flex-1 flex flex-col min-w-0',
          isSidebarCollapsed 
            ? 'pl-20' 
            : (isAdmin ? 'pl-64 md:pl-72' : 'pl-56 md:pl-64')
        )}
      >
        <Topbar onMenuClick={handleMenuClick} />
        <motion.main
          className={cn(
            'p-4 md:p-6 min-h-screen',
            isAdmin || isSeller ? 'pt-20 md:pt-6 pb-24 md:pb-6' : 'pt-20',
          )}
        >
          <motion.div className="w-full pb-12">
            {isSeller && user && !user.isVerified && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-4 text-amber-800 shadow-sm"
              >
                <motion.div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-amber-600" />
                </motion.div>
                <motion.div className="flex-1">
                  <h4 className="font-bold text-sm md:text-base">Account Pending Approval</h4>
                  <p className="text-xs md:text-sm opacity-90">
                    Your account is currently being reviewed by our team. You can explore the
                    panel, but you cannot add products or fulfill purchase orders until verified.
                  </p>
                </motion.div>
                <motion.div className="hidden md:block">
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

      {(isAdmin || isSeller) && <BottomNav navItems={navItems} />}
    </motion.div>
  );
};

export default DashboardLayout;
