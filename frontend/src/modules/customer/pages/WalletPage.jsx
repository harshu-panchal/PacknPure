import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ChevronLeft,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  ShoppingBag,
  Wallet,
  X,
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { cn } from '@/lib/utils';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { useToast } from '@shared/components/ui/Toast';

const ACCENT = '#E23744';
const QUICK_AMOUNTS = [100, 200, 500, 1000];
const MIN_WITHDRAWAL = 100;

const WITHDRAWAL_STATUS_META = {
  Pending: { label: 'Pending review', className: 'bg-amber-50 text-amber-600' },
  Processing: { label: 'Processing', className: 'bg-blue-50 text-blue-600' },
  Settled: { label: 'Paid out', className: 'bg-emerald-50 text-emerald-600' },
  Failed: { label: 'Rejected', className: 'bg-rose-50 text-rose-600' },
};

function payoutSummary(details) {
  if (!details) return '';
  if (details.upiId) return details.upiId;
  if (details.accountNumber) {
    const last4 = details.accountNumber.slice(-4);
    return `A/C ••••${last4}`;
  }
  return '';
}

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load payment gateway'));
    document.body.appendChild(script);
  });
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today) {
    return `Today · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return (
    date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

function WalletSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-36 rounded-2xl bg-slate-200" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-4">
          <div className="h-11 w-11 rounded-xl bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-slate-200" />
            <div className="h-2 w-1/3 rounded bg-slate-200" />
          </div>
          <div className="h-4 w-16 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

function EmptyTransactions() {
  return (
    <div className="px-6 py-14 text-center">
      <div
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(226, 55, 68, 0.08)' }}
      >
        <Receipt size={28} className="text-[#E23744]" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold text-slate-700">No transactions yet</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Refunds and wallet payments will show up here automatically.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
        style={{ backgroundColor: ACCENT }}
      >
        <ShoppingBag size={16} />
        Start shopping
      </Link>
    </div>
  );
}

const WalletPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupSubmitting, setTopupSubmitting] = useState(false);

  const [bankDetails, setBankDetails] = useState(null);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    ifsc: '',
    upiId: '',
  });
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [resumeWithdrawAfterPayout, setResumeWithdrawAfterPayout] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, txRes] = await Promise.all([
        customerApi.getProfile(),
        customerApi.getWalletTransactions({ page: 1, limit: 100 }),
      ]);
      const profile = profileRes.data?.result ?? profileRes.data?.data ?? profileRes.data;
      setBalance(Number(profile?.walletBalance) || 0);
      const rawTx = txRes.data?.result?.items ?? txRes.data?.items ?? [];
      const txs = Array.isArray(rawTx) ? rawTx : [];
      setTransactions(
        txs.map((tx) => ({
          _id: tx._id,
          type: tx.type === 'credit' ? 'credit' : 'debit',
          title: tx.title || (tx.type === 'credit' ? 'Wallet credit' : 'Wallet debit'),
          amount: Number(tx.amount) || 0,
          date: tx.date || tx.createdAt,
          orderId: tx.orderId,
          status: tx.status,
        })),
      );
    } catch (err) {
      console.error('Wallet fetch error:', err);
      setBalance(0);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBankDetails = useCallback(async () => {
    try {
      const res = await customerApi.getBankDetails();
      setBankDetails(res.data?.result ?? null);
    } catch (err) {
      console.error('Bank details fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    loadBankDetails();
  }, [fetchData, loadBankDetails]);

  const filteredTx = useMemo(() => {
    if (filter === 'credit') return transactions.filter((t) => t.type === 'credit');
    if (filter === 'debit') return transactions.filter((t) => t.type === 'debit');
    return transactions;
  }, [transactions, filter]);

  const openAddMoney = () => {
    setTopupAmount('');
    setAddMoneyOpen(true);
  };

  const openPayoutModal = (resumeWithdraw = false) => {
    setPayoutForm({
      bankName: bankDetails?.bankName || '',
      accountHolder: bankDetails?.accountHolder || '',
      accountNumber: bankDetails?.accountNumber || '',
      ifsc: bankDetails?.ifsc || '',
      upiId: bankDetails?.upiId || '',
    });
    setResumeWithdrawAfterPayout(resumeWithdraw);
    setPayoutOpen(true);
  };

  const handlePayoutSubmit = async (e) => {
    e?.preventDefault();
    const { accountHolder, accountNumber, ifsc, upiId } = payoutForm;
    const hasBankFields = accountHolder.trim() || accountNumber.trim() || ifsc.trim();
    if (hasBankFields && (!accountHolder.trim() || !accountNumber.trim() || !ifsc.trim())) {
      showToast('Account holder, account number, and IFSC are all required for bank transfer', 'error');
      return;
    }
    if (!hasBankFields && !upiId.trim()) {
      showToast('Add either your bank account details or a UPI ID', 'error');
      return;
    }

    setPayoutSubmitting(true);
    try {
      const res = await customerApi.updateBankDetails(payoutForm);
      if (res.data?.success) {
        setBankDetails(res.data.result);
        showToast('Payout details saved', 'success');
        setPayoutOpen(false);
        if (resumeWithdrawAfterPayout) {
          setResumeWithdrawAfterPayout(false);
          setWithdrawAmount('');
          setWithdrawOpen(true);
        }
      } else {
        showToast(res.data?.message || 'Could not save payout details', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save payout details', 'error');
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const openWithdraw = () => {
    if (!bankDetails?.hasDetails) {
      showToast('Add your payout details first', 'error');
      openPayoutModal(true);
      return;
    }
    setWithdrawAmount('');
    setWithdrawOpen(true);
  };

  const handleWithdrawSubmit = async (e) => {
    e?.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < MIN_WITHDRAWAL) {
      showToast(`Enter an amount of at least ₹${MIN_WITHDRAWAL}`, 'error');
      return;
    }
    if (amount > balance) {
      showToast('Amount exceeds your wallet balance', 'error');
      return;
    }

    setWithdrawSubmitting(true);
    try {
      const res = await customerApi.requestWithdrawal({ amount });
      if (res.data?.success) {
        showToast('Withdrawal request sent — we’ll process it shortly', 'success');
        setWithdrawOpen(false);
        fetchData();
      } else if (res.data?.result?.code === 'NO_PAYOUT_DETAILS') {
        setWithdrawOpen(false);
        openPayoutModal(true);
      } else {
        showToast(res.data?.message || 'Could not submit withdrawal request', 'error');
      }
    } catch (err) {
      if (err.response?.data?.result?.code === 'NO_PAYOUT_DETAILS') {
        setWithdrawOpen(false);
        showToast('Add your payout details first', 'error');
        openPayoutModal(true);
      } else {
        showToast(err.response?.data?.message || 'Could not submit withdrawal request', 'error');
      }
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const handleTopupSubmit = async (e) => {
    e?.preventDefault();
    const amount = parseFloat(topupAmount);
    if (!amount || amount < 10) {
      showToast('Enter an amount of at least ₹10', 'error');
      return;
    }
    if (amount > 50000) {
      showToast('Maximum ₹50,000 per top-up', 'error');
      return;
    }

    setTopupSubmitting(true);
    try {
      await loadRazorpayScript();

      const orderRes = await customerApi.createWalletTopupOrder({ amount });
      const data = orderRes.data?.result;
      if (!orderRes.data?.success || !data?.razorpayOrderId) {
        throw new Error(orderRes.data?.message || 'Could not start payment');
      }

      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: settings?.appName || 'PacknPure',
        description: 'Add Money to Wallet',
        order_id: data.razorpayOrderId,
        handler: async (response) => {
          try {
            const verifyRes = await customerApi.verifyWalletTopup({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (verifyRes.data?.success) {
              showToast('Money added to your wallet!', 'success');
              setAddMoneyOpen(false);
              fetchData();
            } else {
              showToast(verifyRes.data?.message || 'Verification failed', 'error');
            }
          } catch (err) {
            showToast('Payment verification failed. Contact support if the amount was deducted.', 'error');
          } finally {
            setTopupSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            setTopupSubmitting(false);
          },
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.phone,
        },
        theme: { color: ACCENT },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => {
        showToast('Payment failed. Please try again.', 'error');
        setTopupSubmitting(false);
      });
      rzp.open();
    } catch (err) {
      showToast(err.message || 'Could not start payment', 'error');
      setTopupSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
      {/* Mobile header */}
      <div className="sticky top-0 z-30 border-b border-slate-200/60 bg-slate-50/95 backdrop-blur-sm md:hidden">
        <div className="flex items-center gap-2 px-4 pb-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-200/70"
            aria-label="Go back"
          >
            <ChevronLeft size={22} className="text-slate-800" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Wallet</h1>
            <p className="text-[11px] font-medium text-slate-500">Balance & transactions</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 md:px-6 md:pt-8">
        {/* Desktop header */}
        <div className="mb-5 hidden md:block">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Wallet</h1>
          <p className="mt-1 text-sm text-slate-500">Your store credit and payment history</p>
        </div>

        {loading ? (
          <WalletSkeleton />
        ) : (
          <>
            {/* Balance card */}
            <div
              className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg md:p-6"
              style={{
                background: `linear-gradient(135deg, ${ACCENT} 0%, #b91c1c 100%)`,
                boxShadow: '0 12px 40px rgba(226, 55, 68, 0.25)',
              }}
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-white/5" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-white/80">
                    <Wallet size={18} />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Available balance
                    </span>
                  </div>
                  <p className="text-4xl font-black tracking-tight md:text-5xl">
                    ₹{balance.toLocaleString('en-IN')}
                  </p>
                  <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/75">
                    Order refunds and wallet payments are credited here. Use at checkout.
                  </p>
                </div>
              </div>
              <div className="relative mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={openAddMoney}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-3 text-sm font-bold text-[#E23744] shadow-sm active:scale-[0.98] md:flex-none md:px-6"
                >
                  <Plus size={16} strokeWidth={3} />
                  Add Money
                </button>
                <button
                  type="button"
                  onClick={openWithdraw}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 py-3 text-sm font-bold text-white shadow-sm backdrop-blur-sm active:scale-[0.98] md:flex-none md:px-6"
                >
                  <Banknote size={16} strokeWidth={2.5} />
                  Withdraw
                </button>
              </div>
              <button
                type="button"
                onClick={() => openPayoutModal(false)}
                className="relative mt-3 flex w-full min-w-0 items-center gap-1.5 text-xs font-semibold text-white/80 underline underline-offset-2 hover:text-white"
              >
                <Pencil size={12} className="shrink-0" />
                <span className="min-w-0 truncate">
                  {bankDetails?.hasDetails
                    ? `Payout to ${payoutSummary(bankDetails)} · Edit`
                    : 'Add payout details'}
                </span>
              </button>
            </div>

            {/* Transactions */}
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">Transactions</h2>
                <div className="flex gap-1.5">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'credit', label: 'Credits' },
                    { id: 'debit', label: 'Debits' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFilter(opt.id)}
                      className={cn(
                        'rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                        filter === opt.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTx.length === 0 ? (
                <EmptyTransactions />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredTx.map((tx) => (
                    <li key={tx._id}>
                      <div className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50/80">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                              tx.type === 'credit'
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {tx.type === 'credit' ? (
                              <ArrowDownLeft size={20} strokeWidth={2.5} />
                            ) : (
                              <ArrowUpRight size={20} strokeWidth={2.5} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {tx.title}
                            </p>
                            <p className="text-[11px] text-slate-500">{formatDate(tx.date)}</p>
                            {tx.status && WITHDRAWAL_STATUS_META[tx.status] ? (
                              <span
                                className={cn(
                                  'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold',
                                  WITHDRAWAL_STATUS_META[tx.status].className,
                                )}
                              >
                                {WITHDRAWAL_STATUS_META[tx.status].label}
                              </span>
                            ) : null}
                            {tx.orderId ? (
                              <Link
                                to={`/orders/${tx.orderId}`}
                                className="mt-0.5 inline-block text-[11px] font-semibold text-[#E23744] hover:underline"
                              >
                                Order #{String(tx.orderId).slice(-6)}
                              </Link>
                            ) : null}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 text-sm font-bold tabular-nums',
                            tx.type === 'credit' ? 'text-emerald-600' : 'text-slate-900',
                          )}
                        >
                          {tx.type === 'credit' ? '+' : '−'}₹
                          {tx.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Money modal */}
      {addMoneyOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 md:items-center">
          <div
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-h-[90vh] md:rounded-3xl md:p-6 md:pb-6"
            role="dialog"
            aria-modal="true"
            aria-label="Add money to wallet"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Add Money</h3>
              <button
                type="button"
                onClick={() => !topupSubmitting && setAddMoneyOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTopupSubmit}>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">
                  ₹
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="10"
                  max="50000"
                  autoFocus
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="0"
                  disabled={topupSubmitting}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-11 pr-4 text-2xl font-black text-slate-900 outline-none focus:border-[#E23744] focus:ring-2 focus:ring-[#E23744]/20"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={topupSubmitting}
                    onClick={() => setTopupAmount(String(amt))}
                    className={cn(
                      'rounded-full border px-4 py-1.5 text-xs font-bold transition-colors',
                      String(amt) === topupAmount
                        ? 'border-[#E23744] bg-[#E23744]/10 text-[#E23744]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={topupSubmitting || !topupAmount}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white shadow-lg disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {topupSubmitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Wallet size={18} />
                )}
                {topupSubmitting ? 'Please wait…' : 'Proceed to Pay'}
              </button>
              <p className="mt-3 text-center text-[11px] text-slate-400">
                Secured by Razorpay · Min ₹10, Max ₹50,000
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw modal */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 md:items-center">
          <div
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-h-[90vh] md:rounded-3xl md:p-6 md:pb-6"
            role="dialog"
            aria-modal="true"
            aria-label="Withdraw from wallet"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Withdraw Money</h3>
              <button
                type="button"
                onClick={() => !withdrawSubmitting && setWithdrawOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-4 text-xs font-semibold text-slate-500">
              Available balance: <span className="text-slate-900 font-bold">₹{balance.toLocaleString('en-IN')}</span>
            </p>

            <form onSubmit={handleWithdrawSubmit}>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">
                  ₹
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={MIN_WITHDRAWAL}
                  max={balance}
                  autoFocus
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0"
                  disabled={withdrawSubmitting}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-11 pr-4 text-2xl font-black text-slate-900 outline-none focus:border-[#E23744] focus:ring-2 focus:ring-[#E23744]/20"
                />
              </div>

              <button
                type="button"
                onClick={() => openPayoutModal(false)}
                className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100/80 transition-colors"
              >
                <span className="min-w-0 truncate text-xs text-slate-500">
                  Payout to <span className="font-bold text-slate-900">{payoutSummary(bankDetails)}</span>
                </span>
                <span className="shrink-0 text-[11px] font-bold text-[#E23744]">Change</span>
              </button>

              <button
                type="submit"
                disabled={withdrawSubmitting || !withdrawAmount}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white shadow-lg disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {withdrawSubmitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Banknote size={18} />
                )}
                {withdrawSubmitting ? 'Please wait…' : 'Request Withdrawal'}
              </button>
              <p className="mt-3 text-center text-[11px] text-slate-400">
                Min ₹{MIN_WITHDRAWAL} · Sent to admin for approval, then paid to your account
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Payout details modal */}
      {payoutOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 md:items-center">
          <div
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-h-[90vh] md:rounded-3xl md:p-6 md:pb-6"
            role="dialog"
            aria-modal="true"
            aria-label="Payout details"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Payout Details</h3>
              <button
                type="button"
                onClick={() => !payoutSubmitting && setPayoutOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {resumeWithdrawAfterPayout && (
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p className="text-xs font-semibold leading-relaxed">
                  Add where we should send your money before requesting a withdrawal.
                </p>
              </div>
            )}

            <form onSubmit={handlePayoutSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-500">UPI ID</label>
                <input
                  type="text"
                  placeholder="yourname@upi"
                  value={payoutForm.upiId}
                  onChange={(e) => setPayoutForm((f) => ({ ...f, upiId: e.target.value }))}
                  disabled={payoutSubmitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#E23744] focus:ring-2 focus:ring-[#E23744]/20"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-bold uppercase text-slate-400">Or bank account</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-500">Account Holder Name</label>
                <input
                  type="text"
                  value={payoutForm.accountHolder}
                  onChange={(e) => setPayoutForm((f) => ({ ...f, accountHolder: e.target.value }))}
                  disabled={payoutSubmitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#E23744] focus:ring-2 focus:ring-[#E23744]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-500">Account Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={payoutForm.accountNumber}
                  onChange={(e) => setPayoutForm((f) => ({ ...f, accountNumber: e.target.value }))}
                  disabled={payoutSubmitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#E23744] focus:ring-2 focus:ring-[#E23744]/20"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">IFSC Code</label>
                  <input
                    type="text"
                    value={payoutForm.ifsc}
                    onChange={(e) =>
                      setPayoutForm((f) => ({ ...f, ifsc: e.target.value.toUpperCase() }))
                    }
                    disabled={payoutSubmitting}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold uppercase text-slate-900 outline-none focus:border-[#E23744] focus:ring-2 focus:ring-[#E23744]/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">Bank Name</label>
                  <input
                    type="text"
                    value={payoutForm.bankName}
                    onChange={(e) => setPayoutForm((f) => ({ ...f, bankName: e.target.value }))}
                    disabled={payoutSubmitting}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#E23744] focus:ring-2 focus:ring-[#E23744]/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={payoutSubmitting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white shadow-lg disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {payoutSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
                {payoutSubmitting ? 'Saving…' : 'Save Payout Details'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletPage;
