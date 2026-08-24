import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Gift, Copy, Share2, Users, Clock, CheckCircle2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { customerApi } from '../services/customerApi';

const ACCENT = '#E23744';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div
        className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <p className="text-lg font-black text-slate-900">{value}</p>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
    </div>
  );
}

const ReferAndEarnPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await customerApi.getReferralInfo();
        setData(res.data?.result ?? null);
      } catch (err) {
        console.error('Referral info fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCopyCode = async () => {
    if (!data?.referralCode) return;
    try {
      await navigator.clipboard.writeText(data.referralCode);
      toast.success('Referral code copied!');
    } catch {
      toast.error('Could not copy code');
    }
  };

  const handleCopyLink = async () => {
    if (!data?.shareLink) return;
    try {
      await navigator.clipboard.writeText(data.shareLink);
      toast.success('Link copied!');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleShare = async () => {
    if (!data?.shareLink) return;
    const shareText = `Use my referral code ${data.referralCode} to sign up and get a bonus! ${data.shareLink}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Refer a friend', text: shareText, url: data.shareLink });
      } catch {
        /* user cancelled — no-op */
      }
    } else {
      handleCopyLink();
    }
  };

  const program = data?.program;
  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
      <div className="sticky top-0 z-30 border-b border-slate-200/60 bg-slate-50/95 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-4 pb-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="shrink-0 rounded-full p-1.5 hover:bg-slate-200/70 transition-colors -ml-1.5"
            aria-label="Back"
          >
            <ChevronLeft size={22} className="text-slate-900" />
          </button>
          <h1 className="text-lg font-bold text-slate-900">Refer a Friend</h1>
        </div>
      </div>

      <main className="mx-auto max-w-xl px-4 pt-4 space-y-5">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-40 rounded-2xl bg-slate-200" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-slate-200" />
              ))}
            </div>
          </div>
        ) : !program?.enabled ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Gift size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Referral program isn't live right now</p>
            <p className="mt-1 text-xs text-slate-500">Check back soon — it'll be worth the wait.</p>
          </div>
        ) : (
          <>
            {/* Hero card */}
            <div
              className="relative overflow-hidden rounded-2xl p-6 text-white"
              style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #b91c2f 100%)` }}
            >
              <Gift size={22} className="mb-3 opacity-90" />
              <p className="text-sm font-semibold opacity-90">
                {program?.signupBonus > 0
                  ? `Give ₹${program.signupBonus} and get ₹${program.referrerBonus}`
                  : `Earn ₹${program?.referrerBonus || 0} per referral`}
              </p>
              <p className="mt-1 text-xs opacity-80 leading-relaxed">
                Share your code — your friend gets a signup bonus, and you get rewarded when they place
                their first order{program?.minOrderValue > 0 ? ` of ₹${program.minOrderValue}+` : ''}.
              </p>

              <div className="mt-5 flex items-center justify-between rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                <span className="font-mono text-xl font-black tracking-[0.2em]">{data?.referralCode}</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="rounded-lg bg-white/20 p-2 hover:bg-white/30 transition-colors"
                  aria-label="Copy code"
                >
                  <Copy size={16} />
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold"
                  style={{ color: ACCENT }}
                >
                  <Share2 size={16} />
                  Share Link
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="rounded-xl bg-white/15 px-4 py-3 text-sm font-bold hover:bg-white/25 transition-colors"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Users} label="Total Referred" value={stats?.total ?? 0} color="#3b82f6" />
              <StatCard icon={Clock} label="Pending" value={stats?.pending ?? 0} color="#f59e0b" />
              <StatCard icon={CheckCircle2} label="Completed" value={stats?.completed ?? 0} color="#10b981" />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${ACCENT}18` }}
                >
                  <Wallet size={18} style={{ color: ACCENT }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Total earned from referrals</p>
                  <p className="text-base font-black text-slate-900">₹{stats?.totalEarned ?? 0}</p>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">How it works</p>
              <ol className="space-y-2.5 text-sm text-slate-700">
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">1</span>
                  Share your code or link with a friend.
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">2</span>
                  They enter it while signing up and get their bonus instantly.
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">3</span>
                  You get your bonus the moment their first order goes through.
                </li>
              </ol>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ReferAndEarnPage;
