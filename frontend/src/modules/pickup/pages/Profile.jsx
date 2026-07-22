import React, { useState } from "react";
import { useAuth } from "@core/context/AuthContext";
import {
  User,
  Phone,
  Truck,
  MapPin,
  ShieldCheck,
  LogOut,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Wallet,
  ArrowDownCircle,
  Package,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { clearPickupSessionData } from "../utils/sessionCleanup";
import { getApiErrorMessage } from "../utils/assignmentUtils";
import { usePickupProfile } from "../hooks/usePickupProfile";
import {
  PickupButton,
  PickupInput,
  PickupBottomSheet,
  PickupBadge,
  ProfileSkeleton,
  PickupCard,
  PickupErrorState,
} from "../components/ui";

const kycLabel = (profile) => {
  if (!profile) return "—";
  if (!profile.isActive) return "Inactive";
  const s = String(profile.status || "").toLowerCase();
  if (s === "active") return "Active Partner";
  if (s === "available") return "Available";
  if (s === "inactive") return "Inactive";
  return profile.status || "Partner";
};

const Profile = () => {
  const { user, logout } = useAuth();
  const {
    profile,
    withdrawals,
    assignmentStats,
    loading,
    error,
    fetchAll,
    updateProfile,
    requestWithdrawal,
  } = usePickupProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    vehicleNumber: "",
    address: "",
    location: { type: "Point", coordinates: [0, 0] },
  });

  React.useEffect(() => {
    if (!profile) return;
    setFormData({
      name: profile.name || user?.name || "",
      phone: profile.phone || user?.phone || "",
      vehicleNumber: profile.vehicleType || "",
      address: "",
      location: { type: "Point", coordinates: [0, 0] },
    });
  }, [profile, user]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateProfile({
        name: formData.name,
        vehicleType: formData.vehicleNumber,
        address: formData.address,
        location: formData.location,
      });
      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update profile"));
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
      await requestWithdrawal({ amount, notes: withdrawNotes });
      toast.success("Withdrawal request submitted!");
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      setWithdrawNotes("");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Request failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const balance = Number(profile?.walletBalance || 0);

  const handleLogout = () => {
    clearPickupSessionData();
    logout();
  };

  return (
    <div className="min-h-0 bg-slate-50">
      <div className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 px-4 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] text-white shadow-xl pickup-safe-x">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(45,212,191,0.15),transparent_50%)]" />
        <div className="relative z-10 mx-auto flex max-w-md flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10 backdrop-blur-md sm:h-24 sm:w-24 sm:rounded-3xl">
            <User size={36} className="text-white/90" />
          </div>
          <h2 className="mt-4 max-w-full truncate text-lg font-black tracking-tight sm:text-xl">
            {profile?.name || user?.name || "Partner"}
          </h2>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-teal-300">
            {profile?.hubId ? `Hub · ${profile.hubId}` : `ID · ${user?._id?.slice(-6).toUpperCase() || "------"}`}
          </p>
        </div>
      </div>

      <main className="relative z-20 mx-auto max-w-md space-y-4 px-4 -mt-6 pickup-safe-x sm:space-y-5">
        {loading ? (
          <ProfileSkeleton />
        ) : error ? (
          <PickupErrorState message={error} onRetry={fetchAll} />
        ) : (
          <>
            <PickupCard
              padding="lg"
              className="overflow-hidden border-0 bg-gradient-to-br from-teal-600 to-teal-700 text-white shadow-xl shadow-teal-600/20"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-teal-200" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-teal-100">
                    Balance
                  </span>
                </div>
                <PickupBadge variant="info" className="border-teal-400/30 bg-white/10 text-teal-100">
                  Live
                </PickupBadge>
              </div>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <p className="min-w-0 break-all text-3xl font-black tracking-tight sm:text-4xl">
                  ₹{balance.toFixed(2)}
                </p>
                <PickupButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsWithdrawModalOpen(true)}
                  disabled={balance <= 0}
                  className="shrink-0 border-0 bg-white text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                >
                  Withdraw
                </PickupButton>
              </div>
              {profile?.paymentType && (
                <p className="mt-2 text-[10px] font-semibold text-teal-100/80">
                  {profile.paymentType === "per_trip"
                    ? `Per trip · Base ₹${Number(profile.baseTripRate || 0)} + ₹${Number(profile.perKmRate || 0)}/km`
                    : `Salary · ₹${Number(profile.salaryAmount || 0)}`}
                </p>
              )}
            </PickupCard>

            {assignmentStats && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Today", value: assignmentStats.todayPickups ?? 0, icon: Package },
                  { label: "Pending", value: assignmentStats.pending ?? 0, icon: Clock },
                  { label: "Active", value: assignmentStats.active, icon: Truck },
                  { label: "Done", value: assignmentStats.completed, icon: CheckCircle2 },
                ].map((s) => (
                  <PickupCard key={s.label} padding="sm" className="text-center">
                    <s.icon size={14} className="mx-auto mb-1 text-slate-400" />
                    <p className="text-lg font-black text-slate-900">{s.value}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      {s.label}
                    </p>
                  </PickupCard>
                ))}
              </div>
            )}

            <PickupCard padding="md" className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    profile?.isActive ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      profile?.isActive ? "bg-emerald-500 pickup-pulse-dot" : "bg-amber-400"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Online status
                  </p>
                  <p className="truncate text-sm font-bold text-slate-900">
                    {profile?.isActive ? "Online · Ready for pickups" : "Offline · Contact hub"}
                  </p>
                </div>
              </div>
              <PickupBadge variant={profile?.isActive ? "success" : "warning"}>
                {profile?.isActive ? "Online" : "Offline"}
              </PickupBadge>
            </PickupCard>

            <PickupCard padding="md" className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    profile?.isActive ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <ShieldCheck size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Partner status
                  </p>
                  <p className="truncate text-sm font-bold text-slate-900">{kycLabel(profile)}</p>
                </div>
              </div>
              {profile?.isActive && <CheckCircle2 className="shrink-0 text-emerald-500" size={22} />}
            </PickupCard>

            {withdrawals.length > 0 && (
              <PickupCard padding="none">
                <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
                    Withdrawals
                  </h3>
                </div>
                <div className="divide-y divide-slate-50">
                  {withdrawals.map((w) => (
                    <div
                      key={w._id}
                      className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            w.status === "Pending"
                              ? "bg-amber-50 text-amber-600"
                              : w.status === "Settled"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-slate-50 text-slate-400"
                          }`}
                        >
                          <ArrowDownCircle size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900">
                            ₹{Math.abs(w.amount)}
                          </p>
                          <p className="text-[10px] font-medium text-slate-500">
                            {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : "—"}
                          </p>
                        </div>
                      </div>
                      <PickupBadge
                        variant={
                          w.status === "Pending"
                            ? "warning"
                            : w.status === "Settled"
                              ? "success"
                              : "default"
                        }
                      >
                        {w.status}
                      </PickupBadge>
                    </div>
                  ))}
                </div>
              </PickupCard>
            )}

            <PickupCard padding="none">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
                  Personal details
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="min-h-[32px] rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700"
                >
                  {isEditing ? "Cancel" : "Edit"}
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4 p-4 sm:p-5">
                <PickupInput
                  label="Full name"
                  icon={User}
                  disabled={!isEditing}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                <div className="relative">
                  <PickupInput
                    label="Phone"
                    icon={Phone}
                    disabled
                    value={formData.phone}
                    className="opacity-80"
                  />
                  <CheckCircle2
                    size={14}
                    className="absolute right-4 top-[2.1rem] text-emerald-500"
                  />
                </div>

                <PickupInput
                  label="Vehicle"
                  icon={Truck}
                  disabled={!isEditing}
                  value={formData.vehicleNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, vehicleNumber: e.target.value })
                  }
                  inputClassName="uppercase"
                />

                <div className="space-y-1.5 border-t border-slate-50 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-teal-600">
                      Base location
                    </label>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!navigator.geolocation) {
                            toast.error("Geolocation not supported");
                            return;
                          }
                          toast.loading("Fetching GPS…");
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              const { latitude, longitude } = pos.coords;
                              setFormData((prev) => ({
                                ...prev,
                                location: {
                                  type: "Point",
                                  coordinates: [longitude, latitude],
                                },
                              }));
                              toast.dismiss();
                              toast.success("Location linked!");
                            },
                            () => {
                              toast.dismiss();
                              toast.error("Could not get location");
                            },
                          );
                        }}
                        className="shrink-0 rounded-lg bg-teal-50 px-2 py-1 text-[9px] font-bold uppercase text-teal-700"
                      >
                        Update GPS
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 text-slate-300" size={16} />
                    <textarea
                      disabled={!isEditing}
                      placeholder="Home / base address"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      className="w-full min-h-[80px] resize-none rounded-2xl border-none bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-teal-600 disabled:opacity-70"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {isEditing && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                    >
                      <PickupButton
                        type="submit"
                        fullWidth
                        variant="dark"
                        loading={isLoading}
                      >
                        Save changes
                      </PickupButton>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </PickupCard>

            <PickupCard padding="sm">
              <button
                type="button"
                onClick={() => toast.message("Contact your hub manager for support")}
                className="flex min-h-[52px] w-full items-center justify-between rounded-xl p-3 transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <AlertCircle size={20} />
                  </div>
                  <span className="text-sm font-bold text-slate-900">Help & support</span>
                </div>
                <ChevronRight size={18} className="text-slate-300" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[52px] w-full items-center justify-between rounded-xl p-3 transition-colors hover:bg-rose-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                    <LogOut size={20} />
                  </div>
                  <span className="text-sm font-bold text-rose-600">Logout</span>
                </div>
                <ChevronRight size={18} className="text-rose-200" />
              </button>
            </PickupCard>
          </>
        )}

        <p className="pb-2 text-center text-[10px] font-black uppercase tracking-[0.35em] text-slate-300">
          PacknPure
        </p>
      </main>

      <PickupBottomSheet
        open={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        title="Request withdrawal"
      >
        <p className="mb-4 text-sm text-slate-500">
          Enter the amount to withdraw to your registered bank account.
        </p>

        <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Available
          </span>
          <span className="text-lg font-black text-slate-900">₹{balance.toFixed(2)}</span>
        </div>

        <form onSubmit={handleWithdrawalRequest} className="space-y-4">
          <PickupInput
            label="Amount"
            type="number"
            inputMode="decimal"
            placeholder="e.g. 500"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            inputClassName="text-xl font-black"
          />
          <PickupInput
            label="Notes (optional)"
            placeholder="Bank or reason"
            value={withdrawNotes}
            onChange={(e) => setWithdrawNotes(e.target.value)}
          />
          <div className="flex gap-3 pt-1">
            <PickupButton
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setIsWithdrawModalOpen(false)}
            >
              Cancel
            </PickupButton>
            <PickupButton type="submit" variant="dark" fullWidth loading={isLoading}>
              Confirm
            </PickupButton>
          </div>
        </form>
      </PickupBottomSheet>
    </div>
  );
};

export default Profile;
