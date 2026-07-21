import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ChevronLeft,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  ChevronDown,
  Loader2,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import ProductCard from '../components/shared/ProductCard';
import { useProductDetail } from '../context/ProductDetailContext';
import { customerApi } from '../services/customerApi';
import { normalizeCustomerProduct } from '@shared/utils/productDisplay';
import MiniCart from '../components/shared/MiniCart';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useCart } from '../context/CartContext';
import { useSettings } from '@core/context/SettingsContext';
import { brandColor, brandLogo, NAVBAR_LOGO_CLASS } from '../constants/brandTheme';
import CategoryProductRow from '../components/category/CategoryProductRow';
import { PAGE_CONTAINER } from '../components/home/homeLayout';
import SectionRenderer from '../components/experience/SectionRenderer';

const DEFAULT_SUB_ICON =
  'https://cdn-icons-png.flaticon.com/128/2321/2321831.png';

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
  { id: 'name', label: 'Name (A–Z)' },
];

function SubcategoryButton({ sub, active, onClick, variant = 'mobile' }) {
  if (variant === 'desktop') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-4 border-l-[3px] px-4 py-3 text-left transition-all duration-300 active:scale-[0.98]',
          active
            ? 'border-[#E23744] bg-linear-to-r from-rose-50 to-transparent'
            : 'border-transparent hover:bg-slate-50',
        )}
      >
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-2.5 transition-all duration-300',
            active 
              ? 'scale-110 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.08)] ring-1 ring-rose-100' 
              : 'bg-slate-50 shadow-sm opacity-80 hover:opacity-100 hover:shadow-md hover:-translate-y-0.5',
          )}
        >
          <img src={sub.icon} alt="" className="h-full w-full object-contain drop-shadow-sm" loading="lazy" />
        </span>
        <span 
          className={cn(
            'min-w-0 text-sm font-bold leading-tight transition-colors',
            active ? 'text-[#E23744]' : 'text-slate-600',
          )}
        >
          {sub.name}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full flex-col items-center gap-2 border-l-[3px] px-1 py-3.5 transition-all duration-300 active:scale-95',
        active 
          ? 'border-[#E23744] bg-linear-to-r from-rose-50 to-transparent' 
          : 'border-transparent hover:bg-slate-50',
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full p-2.5 transition-all duration-300',
          active 
            ? 'scale-110 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.08)] ring-1 ring-rose-100' 
            : 'bg-slate-50 shadow-sm opacity-80 hover:opacity-100 hover:shadow-md hover:-translate-y-0.5',
        )}
      >
        <img src={sub.icon} alt="" className="h-full w-full object-contain drop-shadow-sm" loading="lazy" />
      </span>
      <span
        className={cn(
          'line-clamp-2 px-0.5 text-center text-[9px] font-bold leading-tight transition-colors',
          active ? 'text-[#E23744]' : 'text-slate-500',
        )}
      >
        {sub.name}
      </span>
    </button>
  );
}

/**
 * Category PLP — `/category/:categoryId`
 */
const CategoryProductsPage = () => {
  const { categoryName: catId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentLocation } = useAppLocation();
  const { cartCount } = useCart();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { settings } = useSettings();
  const primary = brandColor(settings);
  const logoUrl = brandLogo(settings);
  const appName = settings?.appName || 'App';

  const initialSub = location.state?.activeSubcategoryId || 'all';

  const [selectedSubCategory, setSelectedSubCategory] = useState(initialSub);
  const [category, setCategory] = useState(null);
  const [subCategories, setSubCategories] = useState([
    { id: 'all', name: 'All', icon: DEFAULT_SUB_ICON },
  ]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('relevance');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [ratedOnly, setRatedOnly] = useState(false);
  const [brandFilter, setBrandFilter] = useState('all');

  const [experienceSections, setExperienceSections] = useState([]);
  const [categoryMap, setCategoryMap] = useState({});
  const [subcategoryMap, setSubcategoryMap] = useState({});

  const hasValidLocation =
    Number.isFinite(currentLocation?.latitude) &&
    Number.isFinite(currentLocation?.longitude);

  const loadCategoryMeta = useCallback(async () => {
    try {
      const catRes = await customerApi.getCategories({ tree: true });
      if (!catRes.data?.success) return;

      const tree = catRes.data.results || catRes.data.result || [];
      const currentCat = tree.find(
        (root) => root._id === catId && root.type === 'category',
      );

      if (currentCat) {
        setCategory(currentCat);
        const subs = (currentCat.children || []).map((s) => ({
          id: s._id,
          name: s.name,
          icon: s.image || DEFAULT_SUB_ICON,
        }));
        setSubCategories([
          { id: 'all', name: 'All', icon: DEFAULT_SUB_ICON },
          ...subs,
        ]);
      }
      
      const cMap = {};
      const sMap = {};
      tree.forEach((root) => {
        cMap[root._id] = root;
        if (root.children) {
            root.children.forEach(sub => sMap[sub._id] = sub);
        }
      });
      setCategoryMap(cMap);
      setSubcategoryMap(sMap);
    } catch (e) {
      console.error('[CategoryProductsPage] categories', e);
    }
  }, [catId]);

  const loadProducts = useCallback(async () => {
    if (!hasValidLocation) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const params = {
        categoryId: catId,
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
        limit: 100,
      };
      if (selectedSubCategory && selectedSubCategory !== 'all') {
        params.subcategoryId = selectedSubCategory;
      }

      const prodRes = await customerApi.getProducts(params);
      if (prodRes.data?.success) {
        const rawResult = prodRes.data.result;
        const dbProds = Array.isArray(prodRes.data.results)
          ? prodRes.data.results
          : Array.isArray(rawResult?.items)
            ? rawResult.items
            : Array.isArray(rawResult)
              ? rawResult
              : [];

        const formatted = dbProds.map((p) => ({
          ...normalizeCustomerProduct(p),
          image:
            p.mainImage ||
            p.image ||
            'https://images.unsplash.com/photo-1550989460-0adf9ea622e2',
          deliveryTime: '8–12 mins',
          brand: p.brand || '',
          subcategoryId: p.subcategoryId,
        }));
        setProducts(formatted);
      } else {
        setProducts([]);
      }
    } catch (e) {
      console.error('[CategoryProductsPage] products', e);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    catId,
    selectedSubCategory,
    hasValidLocation,
    currentLocation?.latitude,
    currentLocation?.longitude,
  ]);

  useEffect(() => {
    loadCategoryMeta();
  }, [loadCategoryMeta]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const loadExp = async () => {
      try {
        const res = await customerApi.getExperienceSections({ pageType: 'header', headerId: catId });
        if (res.data?.success) {
          setExperienceSections(res.data.results || res.data.result || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    if (catId) loadExp();
  }, [catId]);

  useEffect(() => {
    setSelectedSubCategory(location.state?.activeSubcategoryId || 'all');
  }, [location.state?.activeSubcategoryId]);

  const brands = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return ['all', ...Array.from(set).sort()];
  }, [products]);

  const productsById = useMemo(() => {
    const map = {};
    products.forEach(p => { map[p._id || p.id] = p; });
    return map;
  }, [products]);

  const displayProducts = useMemo(() => {
    let list = [...products];

    if (brandFilter !== 'all') {
      list = list.filter((p) => p.brand === brandFilter);
    }

    if (ratedOnly) {
      list = list.filter((p) => Number(p.rating) >= 4);
    }

    switch (sortBy) {
      case 'price_asc':
        list.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price_desc':
        list.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'name':
        list.sort((a, b) =>
          String(a.name || '').localeCompare(String(b.name || '')),
        );
        break;
      default:
        break;
    }

    const inStock = list.filter((p) => p.inStock !== false && (Number(p.stockQty ?? p.totalAvailableQty) || 0) > 0);
    const oos = list.filter((p) => p.inStock === false || !((Number(p.stockQty ?? p.totalAvailableQty) || 0) > 0));
    return [...inStock, ...oos];
  }, [products, sortBy, brandFilter, ratedOnly]);

  const sortLabel = SORT_OPTIONS.find((o) => o.id === sortBy)?.label || 'Sort';
  const activeSubName =
    subCategories.find((s) => s.id === selectedSubCategory)?.name || 'All';

  const filterBar = (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-0.5 md:flex-wrap md:overflow-visible">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setShowSortMenu((v) => !v)}
          className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 md:text-sm"
        >
          <SlidersHorizontal size={14} />
          {sortLabel}
          <ChevronDown size={14} className="opacity-60" />
        </button>
        {showSortMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-slate-100 bg-white py-1 shadow-xl">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSortBy(opt.id);
                    setShowSortMenu(false);
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50 md:text-sm',
                    sortBy === opt.id && 'text-brand-600',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setRatedOnly((v) => !v)}
        className={cn(
          'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold md:text-sm',
          ratedOnly
            ? 'border-brand-600 bg-brand-50 text-brand-600'
            : 'border-slate-200 bg-white text-slate-800',
        )}
      >
        <Star
          size={14}
          className={ratedOnly ? 'fill-amber-400 text-amber-400' : 'text-amber-400'}
        />
        Rated 4.0+
      </button>

      {brands.length > 2 && (
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="max-w-[140px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 md:text-sm"
        >
          {brands.map((b) => (
            <option key={b} value={b}>
              {b === 'all' ? 'All brands' : b}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  const productsBody = (
    <>
      {!hasValidLocation && (
        <div className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 md:p-6">
          <MapPin size={20} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-bold text-slate-900">Set delivery location</p>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              Choose your address on home to see products in this category.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-3 text-sm font-bold text-brand-600 hover:underline"
            >
              Go to home
            </button>
          </div>
        </div>
      )}

      {hasValidLocation && isLoading && (
        <>
          <div className="md:hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse border-b border-slate-100 p-3">
                <div className="flex gap-3">
                  <div className="h-20 flex-1 rounded-lg bg-slate-100" />
                  <div className="h-20 w-20 rounded-lg bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </>
      )}

      {hasValidLocation && !isLoading && displayProducts.length === 0 && (
        <div className="py-16 px-4 text-center">
          <p className="text-sm font-bold text-slate-700 md:text-base">
            No products in {activeSubName}
          </p>
          <p className="mt-1 text-xs text-slate-500 md:text-sm">
            Try another subcategory or change filters
          </p>
          {selectedSubCategory !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedSubCategory('all')}
              className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Show all in {category?.name || 'category'}
            </button>
          )}
        </div>
      )}

      {hasValidLocation && !isLoading && displayProducts.length > 0 && (
        <>
          <div className="mb-3 hidden items-center justify-between md:flex">
            <p className="text-sm text-slate-600">
              <span className="font-bold text-slate-900">{displayProducts.length}</span>{' '}
              product{displayProducts.length === 1 ? '' : 's'} · {activeSubName}
            </p>
          </div>

          <div className="md:hidden">
            {displayProducts.map((product) => (
              <CategoryProductRow key={product.id || product._id} product={product} />
            ))}
          </div>

          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-4">
            {displayProducts.map((product) => (
              <ProductCard
                key={product.id || product._id}
                product={product}
                compact
                neutralBg
              />
            ))}
          </div>
        </>
      )}
      {/* Looking for something else — shown after products load */}
      {hasValidLocation && !isLoading && (
        <div className="mx-3 my-5 md:mx-0 md:mt-8">
          <div
            className="relative overflow-hidden rounded-2xl border border-dashed border-brand-200 bg-gradient-to-r from-brand-50 via-rose-50 to-brand-50 px-5 py-5 md:px-8 md:py-6"
          >
            {/* Decorative blobs */}
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-100/40" />
            <div className="pointer-events-none absolute -bottom-4 right-16 h-16 w-16 rounded-full bg-rose-100/60" />

            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm text-xl">
                  🔍
                </span>
                <div>
                  <p className="text-sm font-black text-slate-900 md:text-base">
                    Can't find what you're looking for?
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500 md:text-sm">
                    Tell us and we'll try to source it for you — it's free!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/profile/request-product')}
                className="mt-1 shrink-0 self-start rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95 sm:mt-0 sm:self-auto md:text-sm"
                style={{ backgroundColor: primary }}
              >
                Request a Product →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="relative flex min-h-screen flex-col bg-white font-sans md:bg-slate-50">
      <header
        className={cn(
          'sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-md md:hidden',
          isProductDetailOpen && 'hidden'
        )}
      >
        <div className={cn(PAGE_CONTAINER, 'py-3')}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="shrink-0 rounded-full p-1.5 hover:bg-slate-50"
              aria-label="Back"
            >
              <ChevronLeft size={22} className="text-slate-900" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold text-slate-900">
                {category?.name || 'Category'}
              </h1>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <Link to="/categories" className="font-semibold text-brand-600 hover:underline">
                  Categories
                </Link>
                <span>/</span>
                <span className="truncate font-medium text-slate-700">
                  {category?.name || '…'}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => navigate('/search')}
                className="rounded-full p-2 hover:bg-slate-50"
                aria-label="Search"
              >
                <Search size={22} className="text-slate-800" />
              </button>
              <Link
                to="/checkout"
                className="relative rounded-full p-2 hover:bg-slate-50"
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
          </div>
        </div>
      </header>

      {/* Mobile: sidebar + list */}
      <div className="flex min-h-0 flex-1 md:hidden">
        <aside className="sticky top-[72px] max-h-[calc(100vh-72px)] w-[76px] shrink-0 self-start overflow-y-auto border-r border-slate-100 bg-white pb-28 hide-scrollbar">
          {subCategories.map((sub) => (
            <SubcategoryButton
              key={sub.id}
              sub={sub}
              active={selectedSubCategory === sub.id}
              onClick={() => setSelectedSubCategory(sub.id)}
              variant="mobile"
            />
          ))}
        </aside>

        <main className="min-w-0 flex-1 bg-white">
          {experienceSections.length > 0 && (
              <div className="pt-8 pb-4">
                 <SectionRenderer 
                    sections={experienceSections} 
                    productsById={productsById} 
                    categoriesById={categoryMap} 
                    subcategoriesById={subcategoryMap} 
                 />
              </div>
          )}
          <div className="sticky top-[72px] z-40 border-b border-slate-50 bg-white px-2 py-2">
            {filterBar}
          </div>
          <div className="pb-28">{productsBody}</div>
        </main>
      </div>

      {/* Desktop Breadcrumbs and Title */}
      <div className={cn(PAGE_CONTAINER, 'hidden md:block pt-6 pb-2')}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft size={20} className="text-slate-800 pr-0.5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-slate-900">
              {category?.name || 'Category'}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <Link to="/categories" className="font-semibold text-brand-600 hover:underline">
                Categories
              </Link>
              <span>/</span>
              <span className="font-medium text-slate-700">
                {category?.name || '…'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: sidebar + grid */}
      <div className={cn(PAGE_CONTAINER, 'hidden flex-1 gap-6 py-4 pb-12 md:flex')}>
        <aside className="sticky top-4 hidden h-fit w-56 shrink-0 md:block lg:w-60">
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Subcategories
          </p>
          {subCategories.map((sub) => (
            <SubcategoryButton
              key={sub.id}
              sub={sub}
              active={selectedSubCategory === sub.id}
              onClick={() => setSelectedSubCategory(sub.id)}
              variant="desktop"
            />
          ))}
        </aside>

        <main className="min-w-0 flex-1">
          {experienceSections.length > 0 && (
              <div className="mb-6">
                 <SectionRenderer 
                    sections={experienceSections} 
                    productsById={productsById} 
                    categoriesById={categoryMap} 
                    subcategoriesById={subcategoryMap} 
                 />
              </div>
          )}
          <div className="mb-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            {filterBar}
          </div>
          {productsBody}
        </main>
      </div>

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

export default CategoryProductsPage;
