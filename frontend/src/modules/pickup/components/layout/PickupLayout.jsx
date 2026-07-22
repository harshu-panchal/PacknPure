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
    <div className="pickup-app pickup-page flex min-h-[100dvh] flex-col overflow-x-hidden">
      <main className="flex-1">{children}</main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 px-3 sm:px-4"
        style={{ paddingBottom: "max(0.85rem, env(safe-area-inset-bottom))" }}
        aria-label="Pickup navigation"
      >
        <div
          className={cn(
            "mx-auto flex max-w-md items-center justify-around gap-0.5",
            "rounded-[1.85rem] border border-white/12 bg-slate-950/92 px-2.5 py-2.5",
            "shadow-[var(--pickup-shadow-nav)] backdrop-blur-2xl",
            "sm:px-4 sm:py-3",
          )}
        >
          {navItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex min-h-[50px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 transition-colors duration-200",
                  isActive ? "text-white" : "text-slate-500 hover:text-slate-300",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="pickupNavPill"
                    className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/14 to-white/6 ring-1 ring-white/10"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <item.icon
                  size={20}
                  strokeWidth={isActive ? 2.35 : 2}
                  className={cn("relative z-10 transition-colors", isActive && "text-teal-300")}
                />
                <span
                  className={cn(
                    "relative z-10 text-[9px] font-black uppercase tracking-[0.16em] sm:text-[10px]",
                    isActive ? "text-teal-200" : "opacity-65",
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
            className="relative flex min-h-[50px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-slate-500 transition-colors hover:text-slate-300"
            aria-label="Alerts"
          >
            <Bell size={20} />
            <span className="text-[9px] font-black uppercase tracking-[0.16em] opacity-65 sm:text-[10px]">
              Alerts
            </span>
            {unreadCount > 0 && (
              <span className="absolute right-3 top-2 flex h-4.5 min-w-[17px] items-center justify-center rounded-full border-2 border-slate-950 bg-rose-500 px-1 text-[8px] font-black text-white shadow-sm">
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
