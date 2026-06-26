import { useCallback, useEffect, useMemo, useState } from 'react';
import { STATIC_HOME_REVIEW } from '../constants/homeStaticData';
import { homeService } from '../services/homeService';
import { BRAND_COLOR_LIGHT } from '../constants/brandTheme';
import { buildHomeCategorySections } from '../utils/categoryTree';
import { normalizeCustomerProducts } from '@shared/utils/productDisplay';

/** Full live bundle (products, offers, experience) — same as before */
const ENABLE_HOME_API = true; // Always enable API to fetch products
/**
 * When `true`, home never calls category/hero APIs (fully static catalog + hero).
 * Default: fetch public category tree + hero so admin changes show without enabling full home API.
 */
const STATIC_CATALOG = false; // Always fetch categories

const emptyApiState = {
  categorySections: STATIC_HOME_REVIEW.categorySections,
  heroConfig: { banners: { items: [] }, categoryIds: [] },
  products: STATIC_HOME_REVIEW.featuredProducts,
  experienceSections: [],
  categoryMap: {},
  subcategoryMap: {},
};

function normalizeHeroSlidesFromApi(heroResult) {
  const items = heroResult?.banners?.items;
  if (!Array.isArray(items) || !items.length) return null;
  const active = items.filter(
    (b) => (b?.imageUrl || b?.mobileImageUrl) && (b.status || 'active') === 'active',
  );
  if (!active.length) return null;
  return active.map((b, i) => ({
    id: `api-hero-${i}`,
    layout: 'fullBleed',
    image: b.imageUrl || b.mobileImageUrl,
    mobileImage: b.mobileImageUrl || b.imageUrl,
    alt: b.title || 'Promotion',
    linkType: b.linkType || 'none',
    linkValue: b.linkValue || '',
    title: b.title || '',
    subtitle: b.subtitle || '',
  }));
}
function buildCategoryMaps(dbCats = []) {
  const categoryMap = {};
  const subcategoryMap = {};
  dbCats.forEach((c) => {
    if (c.type === 'category') categoryMap[c._id] = c;
    else if (c.type === 'subcategory') subcategoryMap[c._id] = c;
  });
  return { categoryMap, subcategoryMap };
}

function normalizeProducts(raw = []) {
  return normalizeCustomerProducts(raw).map((p) => ({
    ...p,
    categoryId: p.categoryId,
  }));
}

/**
 * Home data:
 * - **Catalog + hero:** loaded from public APIs by default (set `VITE_HOME_STATIC_CATALOG=true` to disable).
 * - **Products / offers / experience:** when `VITE_ENABLE_HOME_API=true` or customer has map location (lat/lng).
 */
export function useHomePage(currentLocation) {
  const [apiState, setApiState] = useState(emptyApiState);
  const [isCatalogLoading, setIsCatalogLoading] = useState(!STATIC_CATALOG);
  const [isCommerceLoading, setIsCommerceLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCatalog = useCallback(async () => {
    if (STATIC_CATALOG) {
      setIsCatalogLoading(false);
      return;
    }
    setIsCatalogLoading(true);
    try {
      const [catRes, heroRes] = await Promise.all([
        homeService.getCategories({ roots: true }),
        homeService.getHeroConfig({ pageType: 'home' }).catch(() => null),
      ]);
      const roots = catRes.data?.results || catRes.data?.result || [];
      const heroResult = heroRes?.data?.result || heroRes?.data || null;
      const preferredIds = Array.isArray(heroResult?.categoryIds)
        ? heroResult.categoryIds
        : [];
      let categorySections = buildHomeCategorySections(roots, preferredIds);
      if (!categorySections.length) {
        categorySections = STATIC_HOME_REVIEW.categorySections;
      }
      const { categoryMap, subcategoryMap } = buildCategoryMaps(roots);

      setApiState((prev) => ({
        ...prev,
        categorySections,
        heroConfig: heroResult || { banners: { items: [] }, categoryIds: [] },
        categoryMap,
        subcategoryMap,
      }));
    } catch (err) {
      console.error('[useHomePage] catalog', err);
      setApiState((prev) => ({
        ...prev,
        categorySections: STATIC_HOME_REVIEW.categorySections,
        heroConfig: { banners: { items: [] }, categoryIds: [] },
        categoryMap: {},
        subcategoryMap: {},
      }));
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  const fetchCommerce = useCallback(async () => {
    const hasLocation =
      Number.isFinite(currentLocation?.latitude) &&
      Number.isFinite(currentLocation?.longitude);

    if (!ENABLE_HOME_API && !hasLocation) {
      setApiState((prev) => ({
        ...prev,
        products: STATIC_HOME_REVIEW.featuredProducts,
        experienceSections: [],
      }));
      setIsCommerceLoading(false);
      return;
    }

    setIsCommerceLoading(true);
    setError(null);
    try {
      const productParams = { limit: 20 };
      if (hasLocation) {
        productParams.lat = currentLocation.latitude;
        productParams.lng = currentLocation.longitude;
      }

      const [prodRes, expRes] = await Promise.all([
        homeService.getProducts(productParams),
        ENABLE_HOME_API
          ? homeService.getExperienceSections({ pageType: 'home' })
          : Promise.resolve(null),
      ]);

      const items =
        prodRes.data?.result?.items ||
        prodRes.data?.results ||
        prodRes.data?.result ||
        [];

      const normalized = normalizeProducts(Array.isArray(items) ? items : []);

      setApiState((prev) => ({
        ...prev,
        products:
          normalized.length > 0
            ? normalized
            : !hasLocation
              ? STATIC_HOME_REVIEW.featuredProducts
              : [],
        experienceSections: ENABLE_HOME_API
          ? expRes?.data?.results || expRes?.data?.result || []
          : [],
      }));
    } catch (err) {
  console.error('[useHomePage] commerce', err);
  setError(err?.response?.data?.message || 'Failed to load products');
  setApiState((prev) => ({
    ...prev,
    products: STATIC_HOME_REVIEW.featuredProducts,
  }));
} finally {
  setIsCommerceLoading(false);
}
  }, [currentLocation?.latitude, currentLocation?.longitude]);

useEffect(() => {
  fetchCatalog();
}, [fetchCatalog]);

useEffect(() => {
  fetchCommerce();
}, [fetchCommerce]);

const refetch = useCallback(async () => {
  await fetchCatalog();
  await fetchCommerce();
}, [fetchCatalog, fetchCommerce]);

const data = useMemo(() => {
  const apiHeroSlides = normalizeHeroSlidesFromApi(apiState.heroConfig);
  const heroSlides =
    apiHeroSlides && apiHeroSlides.length > 0
      ? apiHeroSlides
      : STATIC_HOME_REVIEW.heroSlides;

  // Use dynamic promoBanner if it exists and is active, else fallback to static
  const promoBelowCategories = 
    apiState.heroConfig?.promoBanner && apiState.heroConfig.promoBanner.status === 'active'
      ? {
          image: apiState.heroConfig.promoBanner.imageUrl,
          eyebrow: apiState.heroConfig.promoBanner.eyebrow,
          title: apiState.heroConfig.promoBanner.title,
          subtitle: apiState.heroConfig.promoBanner.subtitle,
          cta: apiState.heroConfig.promoBanner.cta,
        }
      : STATIC_HOME_REVIEW.promoBelowCategories;

  const isStaticPreview = STATIC_CATALOG;

  return {
    ...STATIC_HOME_REVIEW,
    isStaticPreview,
    categorySections: apiState.categorySections,
    products: apiState.products,
    experienceSections: apiState.experienceSections,
    heroConfig: apiState.heroConfig,
    heroSlides,
    promoBelowCategories,
    categoryMap: apiState.categoryMap,
    subcategoryMap: apiState.subcategoryMap,
    isCatalogLoading,
    isCommerceLoading,
    error,
  };
}, [apiState, isCatalogLoading, isCommerceLoading, error]);

return {
  ...data,
  refetch,
  enableApi: ENABLE_HOME_API,
  /** @deprecated use isCatalogLoading / isCommerceLoading */
  isLoading: isCatalogLoading || isCommerceLoading,
};
}
