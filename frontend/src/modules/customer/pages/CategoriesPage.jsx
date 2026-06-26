import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { buildHomeCategorySections } from '../utils/categoryTree';
import HomeCategorySections from '../components/home/HomeCategorySections';
import { cn } from '@/lib/utils';
import { useSettings } from '@core/context/SettingsContext';
import { brandColor } from '../constants/brandTheme';

/**
 * `/categories` — full “browse all” view (parent categories with name + image).
 * Linked from cart, wishlist, header, and “See all”.
 */
const CategoriesPage = () => {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const { settings } = useSettings();
  const primary = brandColor(settings);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [catRes, heroRes] = await Promise.all([
        customerApi.getCategories({ roots: true }),
        customerApi.getHeroConfig({ pageType: 'home' }).catch(() => null),
      ]);

      const roots = catRes.data?.results || catRes.data?.result || [];
      if (!Array.isArray(roots) || !roots.length) {
        setSections([]);
        return;
      }
      const heroResult = heroRes?.data?.result || heroRes?.data || null;
      const preferredIds = Array.isArray(heroResult?.categoryIds)
        ? heroResult.categoryIds
        : [];

      setSections(buildHomeCategorySections(roots, preferredIds));
    } catch (e) {
      console.error('[CategoriesPage]', e);
      setError('Could not load categories');
      setSections([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const allItems = useMemo(() => {
    const firstSection = sections?.[0];
    const items = firstSection?.items || [];
    return Array.isArray(items) ? items : [];
  }, [sections]);

  const filteredItems = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((c) => String(c?.name || '').toLowerCase().includes(q));
  }, [allItems, query]);

  return (
    <div className="min-h-screen bg-white font-sans md:bg-slate-50">
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-4 md:pb-10 md:pt-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="shrink-0 rounded-full p-1.5 hover:bg-slate-100 transition-colors -ml-1.5"
              aria-label="Back"
            >
              <ChevronLeft size={22} className="text-slate-900" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Categories</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Browse departments &middot; Tap a category to see products
              </p>
            </div>
          </div>
          
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories…"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              style={{ caretColor: primary }}
            />
          </div>
        </div>
        {error && (
          <p className="mb-4 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
            {error}
          </p>
        )}

        {isLoading ? (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 md:gap-5 lg:grid-cols-8">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square w-full rounded-2xl border border-slate-100 bg-slate-100" />
                <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : filteredItems.length ? (
          <HomeCategorySections
            sections={[
              {
                id: 'shop-by-category',
                title: query ? `Results (${filteredItems.length})` : 'Shop by category',
                items: filteredItems,
              },
            ]}
            className={cn(query && 'pt-2')}
          />
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-12 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No categories match “{query}”
            </p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-3 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear search
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default CategoriesPage;
