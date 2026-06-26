import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, User, Bell } from "lucide-react";
import { motion } from "framer-motion";

const PickupLayout = ({ children }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { path: "/pickup/dashboard", label: "Tasks", icon: LayoutGrid },
    { path: "/pickup/profile", label: "Profile", icon: User },
  ];

  // Don't show nav on auth page
  if (currentPath.includes("/auth")) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 overflow-x-hidden">
      <div className="flex-1 pb-20">
        {children}
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-6 pt-2">
        <div className="max-w-md mx-auto bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-[32px] px-8 py-4 shadow-2xl flex items-center justify-between">
          {navItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className="relative flex flex-col items-center gap-1 group"
              >
                <item.icon 
                  size={20} 
                  className={`transition-all duration-300 ${isActive ? "text-indigo-400 scale-110" : "text-slate-500 group-hover:text-slate-300"}`} 
                />
                <span className={`text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? "text-white opacity-100" : "text-slate-500 opacity-60"}`}>
                  {item.label}
                </span>
                
                {isActive && (
                  <motion.div 
                    layoutId="activeBubble"
                    className="absolute -top-10 h-1.5 w-1.5 bg-indigo-400 rounded-full shadow-[0_0_15px_rgba(129,140,248,0.8)]"
                  />
                )}
              </Link>
            );
          })}
          
          <button className="relative flex flex-col items-center gap-1 group">
            <Bell size={20} className="text-slate-500 group-hover:text-slate-300" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 opacity-60">Alerts</span>
            <div className="absolute top-0 right-1 h-2 w-2 bg-rose-500 rounded-full border-2 border-slate-900" />
          </button>
        </div>
      </nav>
    </div>
  );
};

export default PickupLayout;
