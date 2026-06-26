import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  Receipt,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { cn } from '@/lib/utils';

const ACCENT = '#E23744';

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
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
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
          })),
        );
      } catch (err) {
        console.error('Wallet fetch error:', err);
        setBalance(0);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredTx = useMemo(() => {
    if (filter === 'credit') return transactions.filter((t) => t.type === 'credit');
    if (filter === 'debit') return transactions.filter((t) => t.type === 'debit');
    return transactions;
  }, [transactions, filter]);

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
    </div>
  );
};

export default WalletPage;
