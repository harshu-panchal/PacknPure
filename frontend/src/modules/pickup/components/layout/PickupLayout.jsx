import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, User, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";
import PickupAlertsSheet from "../PickupAlertsSheet";
import { usePickupAlertContext } from "../../context/PickupAlertContext";

const PickupLayout = ({ children }) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const isAuth = currentPath.includes("/auth");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const { alerts, unreadCount, markAllRead } = usePickupAlertContext();

  const navItems = [
    { path: "/pickup/dashboard", label: "Tasks", icon: LayoutGrid },
    { path: "/pickup/profile", label: "Profile", icon: User },
  ];

  if (isAuth) {
    return <div className="pickup-app pickup-page pickup-page--no-nav">{children}</div>;
  }

  return (
    <div className="pickup-app pickup-page flex min-h-[100dvh] flex-col overflow-x-hidden bg-slate-50">
      <main className="flex-1">{children}</main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 px-3 sm:px-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        aria-label="Pickup navigation"
      >
        <div
          className={cn(
            "mx-auto flex max-w-md items-center justify-around gap-1",
            "rounded-[1.75rem] border border-white/10 bg-slate-900/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl",
            "sm:px-5 sm:py-3",
          )}
        >
          {navItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex min-h-[48px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 transition-colors",
                  isActive ? "text-white" : "text-slate-500 hover:text-slate-300",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="pickupNavPill"
                    className="absolute inset-0 rounded-2xl bg-white/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <item.icon size={20} className={cn("relative z-10", isActive && "text-teal-400")} />
                <span
                  className={cn(
                    "relative z-10 text-[9px] font-black uppercase tracking-widest sm:text-[10px]",
                    isActive ? "text-teal-300" : "opacity-70",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setAlertsOpen(true)}
            className="relative flex min-h-[48px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-slate-500 hover:text-slate-300"
            aria-label="Alerts"
          >
            <Bell size={20} />
            <span className="text-[9px] font-black uppercase tracking-widest opacity-70 sm:text-[10px]">
              Alerts
            </span>
            {unreadCount > 0 && (
              <span className="absolute right-3 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-slate-900 bg-rose-500 px-1 text-[8px] font-black text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      <PickupAlertsSheet
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        alerts={alerts}
        onMarkAllRead={markAllRead}
      />
    </div>
  );
};

export default PickupLayout;
