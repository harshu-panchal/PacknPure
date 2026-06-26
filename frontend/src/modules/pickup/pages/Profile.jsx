import React, { useState, useEffect } from "react";
import { useAuth } from "@core/context/AuthContext";
import { 
  User, 
  Phone, 
  Truck, 
  MapPin, 
  ShieldCheck, 
  LogOut, 
  ChevronRight, 
  Camera, 
  CheckCircle2,
  AlertCircle,
  Wallet,
  ArrowDownCircle,
  Clock,
  CheckCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { pickupApi } from "../services/pickupApi";

const Profile = () => {
  const { user, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    vehicleNumber: user?.vehicleNumber || "UP-14-AX-5566",
    address: user?.address || "",
    location: user?.location || { type: 'Point', coordinates: [0, 0] },
  });

  const fetchData = async () => {
    try {
      const [pRes, wRes] = await Promise.all([
        pickupApi.getMyProfile(),
        pickupApi.getWithdrawals()
      ]);
      if (pRes.data.success) {
        setProfile(pRes.data.result);
        setFormData({
          name: pRes.data.result.name,
          phone: pRes.data.result.phone,
          vehicleNumber: pRes.data.result.vehicleType,
          address: pRes.data.result.address || "",
          location: pRes.data.result.location || { type: 'Point', coordinates: [0, 0] }
        });
      }
      if (wRes.data.success) setWithdrawals(wRes.data.result.items || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await pickupApi.updateProfile({
        name: formData.name,
        vehicleType: formData.vehicleNumber,
        address: formData.address,
        location: formData.location
      });
      toast.success("Profile updated successfully!");
      setIsEditing(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdrawalRequest = async (e) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");
    if (amount > (profile?.walletBalance || 0)) return toast.error("Insufficient balance");

    setIsLoading(true);
    try {
      await pickupApi.requestWithdrawal({ amount, notes: withdrawNotes });
      toast.success("Withdrawal request submitted to Admin!");
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      setWithdrawNotes("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-['Outfit']">
      {/* Header */}
      <div className="bg-slate-900 text-white p-8 pt-12 rounded-b-[40px] shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative group">
            <div className="h-24 w-24 bg-white/20 backdrop-blur-md rounded-3xl border-2 border-white/30 flex items-center justify-center overflow-hidden">
               {user?.avatar ? (
                 <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <User size={40} className="text-white" />
               )}
            </div>
          </div>
          <h2 className="mt-4 text-xl font-black tracking-tight">{profile?.name || user?.name || "Partner"}</h2>
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-[4px] mt-1">ID: {user?._id?.slice(-6).toUpperCase()}</p>
        </div>
      </div>

      <main className="max-w-md mx-auto px-6 -mt-8 relative z-20 space-y-6">
        {/* Wallet Balance Card */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-[32px] shadow-2xl border border-white/10 text-white overflow-hidden relative group">
          <div className="absolute -right-10 -top-10 h-40 w-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
          <div className="relative z-10 flex flex-col gap-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Wallet size={16} className="text-indigo-200" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Current Balance</span>
                </div>
                <div className="bg-white/10 px-2 py-1 rounded-lg text-[9px] font-bold">LIVE SYNC</div>
             </div>
             <div className="flex items-end justify-between">
                <h3 className="text-4xl font-black tracking-tight">₹{Number(profile?.walletBalance || 0).toFixed(2)}</h3>
                <button 
                  onClick={() => setIsWithdrawModalOpen(true)}
                  className="bg-white text-indigo-600 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all hover:bg-indigo-50"
                >
                  Withdraw
                </button>
             </div>
          </div>
        </div>

        {/* Verification Status Card */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">KYC Status</p>
              <p className="text-sm font-bold text-slate-900">SOP Verified Partner</p>
            </div>
          </div>
          <CheckCircle2 className="text-emerald-500" size={24} />
        </div>

        {/* Withdrawal History */}
        {withdrawals.length > 0 && (
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden">
             <div className="p-6 border-b border-slate-100">
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Recent Withdrawals</h3>
             </div>
             <div className="divide-y divide-slate-50">
                {withdrawals.slice(0, 3).map((w) => (
                  <div key={w._id} className="p-4 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                          w.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 
                          w.status === 'Settled' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                        }`}>
                           <ArrowDownCircle size={18} />
                        </div>
                        <div>
                           <p className="text-xs font-bold text-slate-900">₹{Math.abs(w.amount)}</p>
                           <p className="text-[10px] font-medium text-slate-500">{new Date(w.createdAt).toLocaleDateString()}</p>
                        </div>
                     </div>
                     <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                       w.status === 'Pending' ? 'border-amber-200 text-amber-600 bg-amber-50/50' : 
                       w.status === 'Settled' ? 'border-emerald-200 text-emerald-600 bg-emerald-50/50' : 'border-slate-200 text-slate-400'
                     }`}>
                        {w.status}
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Profile Info Form */}
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Personal Details</h3>
             <button 
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full"
             >
               {isEditing ? "Cancel" : "Edit"}
             </button>
          </div>

          <form onSubmit={handleUpdate} className="p-6 space-y-5">
             <div className="space-y-1.5 group">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    disabled={!isEditing}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-70"
                  />
                </div>
             </div>

             <div className="space-y-1.5 group">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    disabled={true}
                    value={formData.phone}
                    className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-slate-900 opacity-60"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  </div>
                </div>
             </div>

             <div className="space-y-1.5 group">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Vehicle Details</label>
                <div className="relative">
                  <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    disabled={!isEditing}
                    placeholder="Enter Vehicle Number"
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({...formData, vehicleNumber: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-70 placeholder:text-slate-300 uppercase"
                  />
                </div>
             </div>

             <div className="space-y-1.5 group pt-2 border-t border-slate-50">
                <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest ml-1 flex items-center justify-between">
                   Base Location & Address
                   {isEditing && (
                     <button 
                      type="button"
                      onClick={async () => {
                        if (navigator.geolocation) {
                          toast.loading("Fetching GPS...");
                          navigator.geolocation.getCurrentPosition(async (pos) => {
                            const { latitude, longitude } = pos.coords;
                            setFormData(prev => ({
                              ...prev,
                              location: { type: 'Point', coordinates: [longitude, latitude] }
                            }));
                            toast.dismiss();
                            toast.success("Location Linked!");
                          });
                        }
                      }}
                      className="text-[9px] bg-indigo-50 px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition-colors"
                     >
                       Update GPS
                     </button>
                   )}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 text-slate-300" size={16} />
                  <textarea 
                    disabled={!isEditing}
                    placeholder="Enter your home/base address"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-70 placeholder:text-slate-300 min-h-[80px] resize-none"
                  />
                </div>
             </div>

             <AnimatePresence>
               {isEditing && (
                 <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[2px] shadow-xl shadow-slate-200 transition-all hover:bg-black active:scale-95 disabled:opacity-50"
                 >
                   {isLoading ? "Saving..." : "Save Changes"}
                 </motion.button>
               )}
             </AnimatePresence>
          </form>
        </div>

        {/* Support & Logout */}
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl p-2">
           <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors group">
             <div className="flex items-center gap-4">
               <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><AlertCircle size={20}/></div>
               <span className="text-sm font-bold text-slate-900">Help & Support</span>
             </div>
             <ChevronRight size={18} className="text-slate-300" />
           </button>
           <button 
            onClick={logout}
            className="w-full flex items-center justify-between p-4 hover:bg-rose-50 rounded-2xl transition-colors group"
           >
             <div className="flex items-center gap-4">
               <div className="h-10 w-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center"><LogOut size={20}/></div>
               <span className="text-sm font-bold text-rose-600">Logout Session</span>
             </div>
             <ChevronRight size={18} className="text-rose-200" />
           </button>
        </div>
      </main>

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {isWithdrawModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <motion.div 
               initial={{ y: "100%" }}
               animate={{ y: 0 }}
               exit={{ y: "100%" }}
               className="bg-white w-full max-w-md rounded-t-[40px] md:rounded-[40px] p-8 shadow-2xl space-y-6"
             >
                <div className="flex flex-col items-center text-center gap-2">
                   <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-2">
                      <ArrowDownCircle size={32} />
                   </div>
                   <h2 className="text-2xl font-black text-slate-900">Request Withdrawal</h2>
                   <p className="text-sm font-medium text-slate-500">Enter the amount you wish to withdraw to your bank account.</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-3xl flex items-center justify-between">
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Available Balance</span>
                   <span className="text-lg font-black text-slate-900">₹{Number(profile?.walletBalance || 0).toFixed(2)}</span>
                </div>

                <form onSubmit={handleWithdrawalRequest} className="space-y-4">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount to Withdraw</label>
                      <input 
                        type="number"
                        placeholder="e.g. 500"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-4 py-4 text-xl font-black text-slate-900 placeholder:text-slate-300"
                      />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes (Optional)</label>
                      <input 
                        placeholder="Add a reason or bank details"
                        value={withdrawNotes}
                        onChange={(e) => setWithdrawNotes(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-4 py-4 text-sm font-bold text-slate-900"
                      />
                   </div>
                   <div className="flex gap-3 pt-2">
                      <button 
                        type="button"
                        onClick={() => setIsWithdrawModalOpen(false)}
                        className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={isLoading}
                        className="flex-2 bg-slate-900 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isLoading ? "Requesting..." : "Confirm Request"}
                      </button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mt-8 mb-4 text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[6px]">Pack Prep Premium Supply</p>
      </div>
    </div>
  );
};

export default Profile;
