import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Phone,
  Truck,
  CreditCard,
  FileText,
  HelpCircle,
  LogOut,
  ChevronRight,
  Shield,
  Bell,
  Settings,
  IndianRupee,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import axiosInstance from '@core/api/axios';
import { useEffect } from 'react';

const Profile = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { settings } = useSettings();
  const appName = settings?.appName || "App";
  const [faqs, setFaqs] = useState([]);
  const [isImageOpen, setIsImageOpen] = useState(false);

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const response = await axiosInstance.get('/public/faqs', { params: { category: 'Delivery', status: 'published' } });
        setFaqs(response.data.results || []);
      } catch (error) {
        console.error("Error fetching FAQs:", error);
      }
    };
    fetchFaqs();
  }, []);

  const menuItems = [
    {
      icon: User,
      label: "Personal Details",
      sub: "Name, Address, Email",
      color: "text-blue-600 bg-blue-50",
      path: "/delivery/profile/personal-details",
    },
    {
      icon: Truck,
      label: "Vehicle Information",
      sub: "Bike, License, Insurance",
      color: "text-orange-600 bg-orange-50",
      path: "/delivery/profile/vehicle-info",
    },
    {
      icon: CreditCard,
      label: "Bank Account",
      sub: user?.accountNumber ? `Bank **** ${user.accountNumber.slice(-4)}` : "Add Bank Account",
      color: "text-green-600 bg-green-50",
      path: "/delivery/profile/bank-account",
    },
    {
      icon: IndianRupee,
      label: "Money Request",
      sub: "Withdraw your earnings",
      color: "text-emerald-600 bg-emerald-50",
      path: "/delivery/profile/withdrawals",
    },
    {
      icon: FileText,
      label: "Documents",
      sub: "Aadhar, PAN, DL (Verified)",
      color: "text-purple-600 bg-purple-50",
      path: "/delivery/profile/documents",
    },
    {
      icon: Shield,
      label: "Safety & Privacy",
      sub: "Emergency contacts, App permissions",
      color: "text-red-600 bg-red-50",
      path: "/delivery/profile/safety-privacy",
    },
    {
      icon: Settings,
      label: "Settings",
      sub: "Notifications, Language, Theme",
      color: "text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-900",
      path: "/delivery/profile/settings",
    },
    {
      icon: HelpCircle,
      label: "Help & Support",
      sub: "FAQs, Chat support",
      color: "text-teal-600 bg-teal-50",
      path: "/delivery/profile/help-support",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-900 min-h-screen pb-24 transition-colors">
      {/* Header */}
      <div className="bg-primary pt-12 pb-24 px-6 rounded-b-[2.5rem] relative shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-white text-2xl font-bold">My Profile</h1>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white dark:bg-gray-800/20"
            onClick={() => navigate("/delivery/notifications")}>
            <Bell size={24} />
          </Button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <div 
              className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full p-1 shadow-lg relative cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setIsImageOpen(true)}
            >
              <img
                src={user?.documents?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'User'}`}
                alt="Profile"
                className="w-full h-full rounded-full object-cover bg-gray-100 dark:bg-gray-700"
              />
            </div>
            <div className={`absolute bottom-0 right-0 w-6 h-6 ${user?.isOnline ? 'bg-green-500' : 'bg-gray-400'} border-2 border-white rounded-full z-10`}></div>
          </div>
          <div className="text-white">
            <h2 className="font-bold text-xl capitalize">{user?.name || 'Loading...'}</h2>
            <p className="text-white/80 text-sm flex items-center mb-1">
              <Phone size={14} className="mr-1" /> +91 {user?.phone || 'Loading...'}
            </p>
            <div className="flex items-center space-x-2">
              <span className="bg-white/20 dark:bg-gray-800/30 px-2 py-0.5 rounded text-xs font-medium backdrop-blur-sm">
                ID: {user?._id?.slice(-6).toUpperCase() || '-----'}
              </span>
              <span className={`${user?.isVerified ? 'bg-green-500' : 'bg-amber-500'} text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm`}>
                {user?.isVerified ? 'VERIFIED' : 'PENDING'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mx-6 -mt-12 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xl mb-6 flex justify-between text-center relative z-10">
        <div className="flex-1">
          <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
            Joined
          </p>
          <p className="font-bold text-gray-900 dark:text-white text-lg">
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : "N/A"}
          </p>
        </div>
        <div className="w-px bg-gray-100 dark:bg-gray-700"></div>
        <div className="flex-1">
          <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
            Trips
          </p>
          <p className="font-bold text-gray-900 dark:text-white text-lg">{user?.totalOrders || 0}</p>
        </div>
        <div className="w-px bg-gray-100 dark:bg-gray-700"></div>
        <div className="flex-1">
          <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
            Rating
          </p>
          <p className="font-bold text-gray-900 dark:text-white text-lg flex justify-center items-center">
            {user?.rating || "4.8"} <span className="text-yellow-400 text-sm ml-1">★</span>
          </p>
        </div>
      </motion.div>

      {/* Menu Options */}
      <motion.div
        className="px-6 space-y-3 max-w-lg mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible">
        {menuItems.map((item, index) => (
          <motion.button
            key={index}
            variants={itemVariants}
            className="w-full bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md transition-all group"
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(item.path)}>
            <div className="flex items-center">
              <div
                className={`p-3 rounded-full mr-4 transition-colors ${item.color}`}>
                <item.icon size={20} />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                  {item.label}
                </p>
                <p className="text-xs text-gray-400">{item.sub}</p>
              </div>
            </div>
            <ChevronRight
              size={20}
              className="text-gray-300 group-hover:text-primary transition-colors"
            />
          </motion.button>
        ))}

        {/* FAQ Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Delivery Partner FAQs</p>
          <div className="divide-y divide-gray-50">
            {faqs.length > 0 ? (
              faqs.map((faq) => (
                <DeliveryFAQItem
                  key={faq._id}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))
            ) : (
              <div className="py-4 text-center text-xs text-gray-400">No FAQs available</div>
            )}
          </div>
        </div>

        <motion.div variants={itemVariants} className="pt-4">
          <Button
            onClick={logout}
            variant="outline"
            className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 py-6">
            <LogOut size={20} className="mr-2" /> Logout
          </Button>
        </motion.div>
      </motion.div>

      <div className="text-center text-gray-400 text-xs mt-8 pb-4">
        {appName} Delivery Partner App
        <br />
        Version 1.2.0 (Build 450)
      </div>

      {/* Full Screen Image Modal */}
      <AnimatePresence>
        {isImageOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setIsImageOpen(false)}
          >
            {/* Close Button */}
            <button 
              className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-2 transition-colors"
              onClick={(e) => { e.stopPropagation(); setIsImageOpen(false); }}
            >
              <X size={24} />
            </button>

            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-sm w-full aspect-square"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={user?.documents?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'User'}`}
                alt="Profile Full Size"
                className="w-full h-full object-cover rounded-full shadow-2xl border-4 border-white/10"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DeliveryFAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="py-4 px-2 cursor-pointer hover:bg-gray-100 dark:bg-gray-900 transition-colors" onClick={() => setIsOpen(!isOpen)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700">{question}</h3>
        {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>
      {isOpen && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed"
        >
          {answer}
        </motion.p>
      )}
    </div>
  );
};

export default Profile;
