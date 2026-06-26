import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '@shared/components/ui/Badge';
import { HiOutlineCube, HiOutlineArrowPath } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { adminApi } from '../services/adminApi';

function catalogStock(item) {
  const variantSum = (item?.variants || []).reduce(
    (sum, v) => sum + (Number(v?.stock) || 0),
    0,
  );
  if (variantSum > 0) return variantSum;
  return Number(item?.catalogStock ?? item?.availableQtySeller ?? item?.stock ?? 0) || 0;
}

function statusVariant(status) {
  if (status === 'active') return 'success';
  if (status === 'pending_approval') return 'warning';
  if (status === 'rejected') return 'secondary';
  return 'secondary';
}

/**
 * Inline expandable panel: all products for one seller (admin suppliers table).
 */
export default function SellerProductsExpandPanel({ sellerId, sellerName, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    if (!sellerId) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getProducts({
        sellerId,
        ownerType: 'seller',
        page: 1,
        limit: 100,
      });
      const payload = res?.data?.result || {};
      const list = Array.isArray(payload.items) ? payload.items : [];
      setItems(list);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load products');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [sellerId]);

  return (
    <div className="bg-slate-50/80 border-t border-b border-violet-100 px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <HiOutlineCube className="h-4 w-4 text-violet-600" />
          <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Products by {sellerName || 'Supplier'}
          </p>
          <Badge variant="primary" className="text-[8px] px-1.5">
            {items.length} listing{items.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-600 bg-white ring-1 ring-slate-200 rounded-lg hover:bg-slate-50"
          >
            <HiOutlineArrowPath className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() =>
              navigate('/admin/products', { state: { sellerFilterId: sellerId, productTab: 'seller' } })
            }
            className="px-3 py-1.5 text-[10px] font-bold text-violet-700 bg-violet-50 ring-1 ring-violet-200 rounded-lg hover:bg-violet-100"
          >
            Open in Products
          </button>
          <button
            type="button"
            onClick={() => navigate(`/admin/suppliers/${sellerId}`)}
            className="px-3 py-1.5 text-[10px] font-bold text-slate-600 bg-white ring-1 ring-slate-200 rounded-lg hover:bg-slate-50"
          >
            Full profile
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-800"
            >
              Collapse
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 gap-3 text-slate-400">
          <div className="h-8 w-8 border-2 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest">Loading products...</span>
        </div>
      ) : error ? (
        <p className="text-center text-xs font-bold text-rose-500 py-6">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-center text-xs font-bold text-slate-400 py-8 uppercase tracking-widest">
          No products listed yet
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-center">Supply price</th>
                <th className="px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-center">Stock (S)</th>
                <th className="px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider">Master catalog</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((p) => {
                const stock = catalogStock(p);
                const masterName =
                  p.masterProductId && typeof p.masterProductId === 'object'
                    ? p.masterProductId.name
                    : null;
                return (
                  <tr key={p._id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-lg overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0">
                          {p.mainImage ? (
                            <img src={p.mainImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-300">
                              <HiOutlineCube className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-slate-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.categoryId?.name || '—'}
                      {p.subcategoryId?.name ? (
                        <span className="block text-[10px] text-slate-400">{p.subcategoryId.name}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800">
                      ₹{Number(p.purchasePrice || p.price || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'font-black',
                          stock === 0 ? 'text-rose-600' : stock <= 10 ? 'text-amber-600' : 'text-emerald-600',
                        )}
                      >
                        {stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={statusVariant(p.status)} className="text-[8px] uppercase">
                        {(p.status || '—').replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-[11px]">
                      {masterName || (
                        <span className="text-slate-400 italic">Not mapped</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
