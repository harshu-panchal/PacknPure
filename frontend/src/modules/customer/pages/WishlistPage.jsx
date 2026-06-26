import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, ShoppingBag, Trash2 } from 'lucide-react';
import ProductCard from '../components/shared/ProductCard';
import WishlistProductRow from '../components/shared/WishlistProductRow';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useToast } from '@shared/components/ui/Toast';
import { normalizeCustomerProducts } from '@shared/utils/productDisplay';
import { cn } from '@/lib/utils';

const ACCENT = '#E23744';

function WishlistSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3">
          <div className="h-[88px] w-[88px] rounded-xl bg-slate-200" />
          <div className="flex flex-1 flex-col gap-2 py-1">
            <div className="h-3 w-3/4 rounded bg-slate-200" />
            <div className="h-3 w-1/2 rounded bg-slate-200" />
            <div className="mt-auto h-8 w-24 rounded-lg bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyWishlist() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <div
        className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(226, 55, 68, 0.1)' }}
      >
        <Heart size={36} className="text-[#E23744]" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-bold text-slate-900">Your list is empty</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Tap the heart on any product while you shop — saved items show up here for quick
        ordering later.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg"
          style={{ backgroundColor: ACCENT, boxShadow: '0 8px 24px rgba(226,55,68,0.3)' }}
        >
          <ShoppingBag size={18} />
          Start shopping
        </Link>
        <Link
          to="/categories"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Browse categories
        </Link>
      </div>
    </div>
  );
}

const WishlistPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { addToCart } = useCart();
  const {
    wishlist,
    clearWishlist,
    fetchFullWishlist,
    isFullDataFetched,
    loading,
    removeFromWishlist,
  } = useWishlist();

  const [sortBy, setSortBy] = useState('saved');

  useEffect(() => {
    if (!isFullDataFetched) {
      fetchFullWishlist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullDataFetched]);

  const products = useMemo(
    () => normalizeCustomerProducts(wishlist),
    [wishlist],
  );

  const inStockCount = useMemo(() => {
    return products.filter(
      (p) =>
        p.inStock !== false &&
        ((Number(p.stockQty) || Number(p.stock) || 0) > 0 ||
          (p.variants || []).some((v) => (Number(v.stock) || 0) > 0)),
    ).length;
  }, [products]);

  const sortedProducts = useMemo(() => {
    const list = [...products];
    if (sortBy === 'price_asc') {
      list.sort(
        (a, b) =>
          (Number(a.displayPrice ?? a.price) || 0) -
          (Number(b.displayPrice ?? b.price) || 0),
      );
    } else if (sortBy === 'price_desc') {
      list.sort(
        (a, b) =>
          (Number(b.displayPrice ?? b.price) || 0) -
          (Number(a.displayPrice ?? a.price) || 0),
      );
    } else if (sortBy === 'name') {
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }
    return list;
  }, [products, sortBy]);

  const handleClearAll = () => {
    if (!products.length) return;
    if (!window.confirm('Remove all items from your list?')) return;
    products.forEach((p) => removeFromWishlist(p.id || p._id));
    clearWishlist();
    showToast('Wishlist cleared', 'info');
  };

  const handleAddAllAvailable = () => {
    let added = 0;
    products.forEach((product) => {
      const inStock =
        product.inStock !== false &&
        ((Number(product.stockQty) || Number(product.stock) || 0) > 0 ||
          (product.variants || []).some((v) => (Number(v.stock) || 0) > 0));
      const variantCount = product.variants?.length || 0;
      const mustPickVariant = product.hasMultipleVariants && variantCount > 1;
      if (!inStock || mustPickVariant) return;

      const singleVariant = variantCount === 1 ? product.variants[0] : null;
      const variantId = singleVariant?._id || singleVariant?.id;
      addToCart({
        ...product,
        ...(variantId
          ? { selectedVariantId: String(variantId), variantId: String(variantId) }
          : {}),
      });
      added += 1;
    });

    if (added > 0) {
      showToast(`${added} item${added === 1 ? '' : 's'} added to cart`, 'success');
    } else {
      showToast('Select pack sizes for multi-variant items', 'info');
    }
  };

  const isLoading = loading && !isFullDataFetched;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
      {/* Mobile header */}
      <div className="sticky top-0 z-30 border-b border-slate-200/60 bg-slate-50/95 backdrop-blur-sm md:hidden">
        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-200/70"
              aria-label="Go back"
            >
              <ChevronLeft size={22} className="text-slate-800" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">My list</h1>
              <p className="text-[11px] font-medium text-slate-500">
                {products.length} {products.length === 1 ? 'item' : 'items'} saved
              </p>
            </div>
          </div>
          {products.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70"
            >
              <Trash2 size={14} />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 md:px-6">
        {/* Desktop header */}
        <div className="mb-6 hidden items-center justify-between gap-4 md:flex md:pt-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft size={20} className="text-slate-800 pr-0.5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">My wishlist</h1>
              <p className="mt-1 text-sm text-slate-500">
                {products.length} {products.length === 1 ? 'item' : 'items'} saved
              </p>
            </div>
          </div>
          {products.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Trash2 size={16} />
              Clear all
            </button>
          )}
        </div>

        {isLoading ? (
          <WishlistSkeleton />
        ) : products.length === 0 ? (
          <EmptyWishlist />
        ) : (
          <>
            <div className="mb-4 mt-4 flex flex-wrap items-center justify-between gap-3 md:mt-0">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {[
                  { id: 'saved', label: 'Recently saved' },
                  { id: 'price_asc', label: 'Price ↑' },
                  { id: 'price_desc', label: 'Price ↓' },
                  { id: 'name', label: 'A–Z' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id)}
                    className={cn(
                      'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                      sortBy === opt.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {inStockCount > 0 && (
                <button
                  type="button"
                  onClick={handleAddAllAvailable}
                  className="shrink-0 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md"
                  style={{ backgroundColor: ACCENT }}
                >
                  Add all in stock
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:hidden">
              {sortedProducts.map((product) => (
                <WishlistProductRow
                  key={product.id || product._id}
                  product={product}
                />
              ))}
            </div>

            <div className="hidden gap-4 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {sortedProducts.map((product) => (
                <ProductCard key={product.id || product._id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
