import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useNavigate,
  useLocation as useRouterLocation,
  useSearchParams,
  Link,
} from 'react-router-dom';
import {
  Search,
  ChevronLeft,
  X,
  Clock,
  TrendingUp,
  Loader2,
  MapPin,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@core/context/SettingsContext';
import { brandColor, brandLogo, NAVBAR_LOGO_CLASS } from '../constants/brandTheme';
import { customerApi } from '../services/customerApi';
import { useProductDetail } from '../context/ProductDetailContext';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useCart } from '../context/CartContext';
import { normalizeCustomerProduct } from '@shared/utils/productDisplay';
import CategoryProductRow from '../components/category/CategoryProductRow';
import ProductCard from '../components/shared/ProductCard';

import MiniCart from '../components/shared/MiniCart';
import { useDebouncedValue, DEBOUNCE_MS } from '@shared/hooks/useDebounce';
import { PAGE_CONTAINER } from '../components/home/homeLayout';

const RECENT_KEY = 'appzeto_recent_searches';
const SUGGESTED = ['Milk', 'Bread', 'Eggs', 'Rice', 'Vegetables', 'Fruits', 'Snacks'];

function parseProductsResponse(response) {
  if (!response?.data?.success) return [];
  const rawResult = response.data.result;
  const dbProds = Array.isArray(response.data.results)
    ? response.data.results
    : Array.isArray(rawResult?.items)
      ? rawResult.items
      : Array.isArray(rawResult)
        ? rawResult
        : [];
  return dbProds.map((p) => normalizeCustomerProduct(p));
}

const ChipButton = ({ children, onClick, onRemove, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white text-[13px] font-semibold text-slate-800 transition-colors hover:border-brand-200 hover:bg-brand-50 active:scale-[0.98] md:rounded-lg',
      className,
    )}
  >
    {children}
    {onRemove ? (
      <span
        role="button"
        tabIndex={0}
        onClick={onRemove}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onRemove(e);
        }}
        className="rounded-full p-1 hover:bg-slate-100"
        aria-label="Remove"
      >
        <X size={12} className="text-slate-400" />
      </span>
    ) : null}
  </button>
);

const SearchPage = () => {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { currentLocation } = useAppLocation();
  const { cartCount } = useCart();
  const { settings } = useSettings();
  const primary = brandColor(settings);
  const logoUrl = brandLogo(settings);

  const initialQuery =
    routerLocation.state?.query || searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [browseProducts, setBrowseProducts] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isBrowseLoading, setIsBrowseLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS.search);

  const [pastSearches, setPastSearches] = useState(() => {
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const hasValidLocation =
    Number.isFinite(currentLocation?.latitude) &&
    Number.isFinite(currentLocation?.longitude);

  const saveSearch = useCallback((term) => {
    const t = String(term || '').trim();
    if (!t) return;
    setPastSearches((prev) => {
      const updated = [t, ...prev.filter((s) => s !== t)].slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const applyQuery = useCallback(
    (term, { persist = true } = {}) => {
      const t = String(term || '').trim();
      setQuery(t);
      if (persist && t) {
        setSearchParams(t ? { q: t } : {}, { replace: true });
      }
    },
    [setSearchParams],
  );

  const handleRemoveSearch = (e, term) => {
    e.stopPropagation();
    setPastSearches((prev) => {
      const updated = prev.filter((s) => s !== term);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    if (!hasValidLocation) {
      setBrowseProducts([]);
      setIsBrowseLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setIsBrowseLoading(true);
      try {
        const response = await customerApi.getProducts({
          limit: 40,
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
        });
        if (!cancelled) setBrowseProducts(parseProductsResponse(response));
      } catch (e) {
        console.error('[SearchPage] browse', e);
        if (!cancelled) setBrowseProducts([]);
      } finally {
        if (!cancelled) setIsBrowseLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [hasValidLocation, currentLocation?.latitude, currentLocation?.longitude]);

  const debouncedTerm = String(debouncedQuery ?? '').trim();

  useEffect(() => {
    if (!debouncedTerm) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    if (!hasValidLocation) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    (async () => {
      try {
        const response = await customerApi.getProducts({
          search: debouncedTerm,
          limit: 50,
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
        });
        if (!cancelled) setResults(parseProductsResponse(response));
      } catch (e) {
        console.error('[SearchPage] search', e);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedTerm, hasValidLocation, currentLocation?.latitude, currentLocation?.longitude]);

  const isPendingSearch = Boolean(query.trim()) && debouncedTerm !== query.trim();

  const lowestPriceProducts = useMemo(() => {
    return [...browseProducts]
      .filter((p) => p.inStock !== false && (Number(p.stock) || 0) > 0)
      .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))
      .slice(0, 12);
  }, [browseProducts]);

  const handleSubmitSearch = () => {
    const term = query.trim();
    if (!term) return;
    saveSearch(term);
    setSearchParams({ q: term }, { replace: true });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmitSearch();
  };

  const pickSuggestion = (term) => {
    applyQuery(term);
    saveSearch(term);
  };

  const showResults = Boolean(query.trim());
  const showSearchLoading = isSearching || isPendingSearch;

  const searchInput = (
    <div className="relative min-w-0 flex-1">
      <Search
        size={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 md:left-4"
      />
      <input
        autoFocus
        type="search"
        enterKeyHint="search"
        placeholder='Search "milk, bread, snacks…"'
        value={query}
        onChange={(e) => applyQuery(e.target.value, { persist: false })}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (query.trim()) setSearchParams({ q: query.trim() }, { replace: true });
        }}
        className={cn(
          'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10',
          'text-sm font-semibold text-slate-900 placeholder:text-slate-400',
          'outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100',
          'md:h-12 md:rounded-2xl md:pl-12 md:text-base',
        )}
      />
      {query ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-200/80 p-1.5 hover:bg-slate-300"
          aria-label="Clear search"
        >
          <X size={14} className="text-slate-600" />
        </button>
      ) : null}
    </div>
  );

  const suggestionsPanel = (
    <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-[280px_1fr] md:gap-8 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-6 md:sticky md:top-28 md:self-start">
        {pastSearches.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-1.5">
              <Clock size={14} className="text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Recent searches
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {pastSearches.map((term) => (
                <ChipButton
                  key={term}
                  onClick={() => pickSuggestion(term)}
                  onRemove={(e) => handleRemoveSearch(e, term)}
                  className="pl-3 pr-1.5 py-2"
                >
                  {term}
                </ChipButton>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center gap-1.5">
            <TrendingUp size={14} style={{ color: primary }} />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Popular searches
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((term) => (
              <ChipButton
                key={term}
                onClick={() => pickSuggestion(term)}
                className="px-3 py-2 md:hover:border-brand-300 md:hover:text-brand-600"
              >
                {term}
              </ChipButton>
            ))}
          </div>
        </section>
      </aside>

      <section>
        <h2 className="mb-4 text-base font-bold text-slate-900 md:text-lg">
          Lowest prices near you
        </h2>
        {isBrowseLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : lowestPriceProducts.length > 0 ? (
          <>
            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar -mx-1 px-1 snap-x md:hidden">
              {lowestPriceProducts.map((product) => (
                <div
                  key={product.id || product._id}
                  className="min-w-[130px] max-w-[130px] shrink-0 snap-start"
                >
                  <ProductCard product={product} compact />
                </div>
              ))}
            </div>
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-4">
              {lowestPriceProducts.map((product) => (
                <ProductCard key={product.id || product._id} product={product} compact neutralBg />
              ))}
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-xs text-slate-500 md:text-sm">
            {hasValidLocation
              ? 'No products available in your area yet'
              : 'Set location to see deals'}
          </p>
        )}
      </section>
    </div>
  );

  const resultsContent = (
    <>
      <div className="flex items-center justify-between border-b border-slate-100 px-1 py-3 md:px-0 md:pb-4">
        <h2 className="text-base font-bold text-slate-900 md:text-xl">Search results</h2>
        {!showSearchLoading && (
          <span className="text-xs font-semibold text-slate-500 md:text-sm">
            {results.length} item{results.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {showSearchLoading && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: primary }} />
          <p className="text-sm font-semibold">Searching…</p>
        </div>
      )}

      {!showSearchLoading && results.length > 0 && (
        <>
          <div className="md:hidden">
            {results.map((product) => (
              <div key={product.id || product._id} onClick={() => saveSearch(query)}>
                <CategoryProductRow product={product} />
              </div>
            ))}
          </div>
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-4 md:pt-2">
            {results.map((product) => (
              <div key={product.id || product._id} onClick={() => saveSearch(query)}>
                <ProductCard product={product} compact neutralBg />
              </div>
            ))}
          </div>
        </>
      )}

      {!showSearchLoading && results.length === 0 && hasValidLocation && (
        <div className="px-2 py-16 text-center md:px-0">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
            <Search size={28} className="text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-800 md:text-base">
            No matches for &quot;{query}&quot;
          </p>
          <p className="mt-1 text-xs text-slate-500 md:text-sm">
            Try another spelling or pick a suggestion
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTED.slice(0, 6).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => pickSuggestion(s)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-600 md:text-sm"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="relative flex min-h-full flex-col bg-white font-sans md:bg-slate-50">
      <header
        className={cn(
          'sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-md',
          isProductDetailOpen && 'hidden md:block',
        )}
      >
        <div className={cn(PAGE_CONTAINER, 'py-3 md:py-4')}>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="shrink-0 rounded-full p-1.5 hover:bg-slate-100 transition-colors -ml-1.5"
                aria-label="Back"
              >
                <ChevronLeft size={22} className="text-slate-900" />
              </button>
              <span className="hidden md:block text-base font-semibold tracking-tight text-slate-800 ml-1">
                Explore
              </span>
            </div>

            {searchInput}

            <Link
              to="/checkout"
              className="relative shrink-0 rounded-full p-2 hover:bg-slate-50 md:hidden"
              aria-label="Cart"
            >
              <ShoppingCart size={22} className="text-slate-800" />
              {cartCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ backgroundColor: primary }}
                >
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>
          </div>

          <p className="mt-2 hidden text-xs text-slate-500 md:block">
            Press Enter to search · Results update as you type
          </p>
        </div>
      </header>

      <main className={cn(PAGE_CONTAINER, 'flex-1 py-4 pb-8 md:py-6 md:pb-12')}>
        {!hasValidLocation && (
          <div className="mb-4 flex gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 md:mb-6">
            <MapPin size={20} className="mt-0.5 shrink-0" style={{ color: primary }} />
            <div>
              <p className="text-sm font-bold text-slate-900">Set delivery location</p>
              <p className="mt-1 text-xs text-slate-600 md:text-sm">
                Search and shop are available after you choose an address on home.
              </p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-2 text-xs font-bold md:text-sm"
                style={{ color: primary }}
              >
                Go to home →
              </button>
            </div>
          </div>
        )}

        {showResults ? (
          <section>{resultsContent}</section>
        ) : (
          suggestionsPanel
        )}
      </main>

      <MiniCart />


      <style
        dangerouslySetInnerHTML={{
          __html: `
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `,
        }}
      />
    </div>
  );
};

export default SearchPage;
