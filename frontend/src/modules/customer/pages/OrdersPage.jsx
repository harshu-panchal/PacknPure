import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Package,
  ShoppingBag,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { getLegacyStatusFromOrder, getOrderStatusLabel } from '@/shared/utils/orderStatus';
import { cn } from '@/lib/utils';

const ACCENT = '#E23744';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

function statusMeta(legacy) {
  switch (legacy) {
    case 'delivered':
      return {
        icon: CheckCircle2,
        pill: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
        dot: 'bg-emerald-500',
      };
    case 'cancelled':
      return {
        icon: XCircle,
        pill: 'bg-slate-100 text-slate-600 ring-slate-200',
        dot: 'bg-slate-400',
      };
    case 'out_for_delivery':
      return {
        icon: Truck,
        pill: 'bg-violet-50 text-violet-700 ring-violet-100',
        dot: 'bg-violet-500',
      };
    case 'confirmed':
    case 'packed':
      return {
        icon: Package,
        pill: 'bg-blue-50 text-blue-700 ring-blue-100',
        dot: 'bg-blue-500',
      };
    default:
      return {
        icon: Clock,
        pill: 'bg-amber-50 text-amber-700 ring-amber-100',
        dot: 'bg-amber-500',
      };
  }
}

function matchesTab(order, tab) {
  const legacy = getLegacyStatusFromOrder(order);
  if (tab === 'all') return true;
  if (tab === 'delivered') return legacy === 'delivered';
  if (tab === 'cancelled') return legacy === 'cancelled';
  if (tab === 'active') {
    return legacy !== 'delivered' && legacy !== 'cancelled';
  }
  return true;
}

function OrdersSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex gap-3">
            <div className="h-14 w-14 rounded-xl bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-slate-200" />
              <div className="h-2 w-1/2 rounded bg-slate-200" />
            </div>
          </div>
          <div className="mt-3 h-2 w-full rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyOrders() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16 text-center">
      <div
        className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(226, 55, 68, 0.08)' }}
      >
        <Package size={36} className="text-[#E23744]" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-bold text-slate-900">No orders yet</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        When you place an order, track delivery and view details here.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg"
        style={{ backgroundColor: ACCENT, boxShadow: '0 8px 24px rgba(226,55,68,0.3)' }}
      >
        <ShoppingBag size={18} />
        Start shopping
      </Link>
    </div>
  );
}

function OrderCard({ order }) {
  const legacy = getLegacyStatusFromOrder(order);
  const meta = statusMeta(legacy);
  const StatusIcon = meta.icon;
  const label = getOrderStatusLabel(order);
  const items = order.items || [];
  const itemCount = items.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
  const total = order.pricing?.total ?? order.pricing?.subtotal ?? 0;
  const thumb = items[0]?.image || items[0]?.product?.mainImage;
  const names = items.map((i) => i.name).filter(Boolean);
  const summary =
    names.length > 1
      ? `${names[0]} +${names.length - 1} more`
      : names[0] || 'Order items';

  const created = new Date(order.createdAt);
  const dateStr = created.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = created.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Link
      to={`/orders/${order.orderId}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package size={22} className="text-slate-300" />
            </div>
          )}
          {itemCount > 1 ? (
            <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-[9px] font-bold text-white">
              {itemCount}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900">
                Order #{String(order.orderId).slice(-8)}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                {dateStr} · {timeStr}
              </p>
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1',
                meta.pill,
              )}
            >
              <StatusIcon size={11} strokeWidth={2.5} />
              {label}
            </span>
          </div>

          <p className="mt-2 line-clamp-1 text-xs text-slate-600">{summary}</p>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[11px] font-medium text-slate-500">
              {itemCount} item{itemCount === 1 ? '' : 's'}
              {order.payment?.method ? (
                <span className="text-slate-400"> · {order.payment.method}</span>
              ) : null}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-base font-bold text-slate-900">
                ₹{Number(total).toLocaleString('en-IN')}
              </span>
              <ChevronRight size={16} className="text-slate-300" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

const OrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await customerApi.getMyOrders();
        const data = response.data?.results ?? response.data?.result ?? [];
        setOrders(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const filteredOrders = useMemo(
    () => orders.filter((o) => matchesTab(o, tab)),
    [orders, tab],
  );

  const tabCounts = useMemo(() => {
    const counts = { all: orders.length, active: 0, delivered: 0, cancelled: 0 };
    orders.forEach((o) => {
      const legacy = getLegacyStatusFromOrder(o);
      if (legacy === 'delivered') counts.delivered += 1;
      else if (legacy === 'cancelled') counts.cancelled += 1;
      else counts.active += 1;
    });
    return counts;
  }, [orders]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      <main className="mx-auto max-w-2xl px-4 pt-4 md:max-w-3xl md:px-6 md:pt-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="shrink-0 rounded-full p-1.5 hover:bg-slate-200/70 transition-colors -ml-1.5"
              aria-label="Back"
            >
              <ChevronLeft size={22} className="text-slate-900" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">My orders</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {orders.length} order{orders.length === 1 ? '' : 's'} · Track deliveries and view history
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <OrdersSkeleton />
        ) : orders.length === 0 ? (
          <EmptyOrders />
        ) : (
          <>
            {/* Filter tabs */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                    tab === t.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  {t.label}
                  {tabCounts[t.id] > 0 ? (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px]',
                        tab === t.id ? 'bg-white/20' : 'bg-slate-100',
                      )}
                    >
                      {tabCounts[t.id]}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
                <p className="text-sm font-semibold text-slate-600">No orders in this tab</p>
                <button
                  type="button"
                  onClick={() => setTab('all')}
                  className="mt-2 text-xs font-semibold text-[#E23744] hover:underline"
                >
                  View all orders
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <OrderCard key={order._id || order.orderId} order={order} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default OrdersPage;
