/**
 * Customer catalog display — card price from first variant; keeps full variants[] for picker.
 */

export const PRODUCT_IMAGE_PLACEHOLDER =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=400&fit=crop';

/** Resolve a usable image URL (absolute Cloudinary, relative upload path, or placeholder). */
export function resolveProductImageUrl(product) {
  if (!product || typeof product !== 'object') return PRODUCT_IMAGE_PLACEHOLDER;

  const candidates = [
    product.image,
    product.mainImage,
    ...(Array.isArray(product.galleryImages) ? product.galleryImages : []),
    ...(Array.isArray(product.images) ? product.images : []),
  ];

  for (const raw of candidates) {
    const url = String(raw || '').trim();
    if (!url) continue;
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    ) {
      return url;
    }
    const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api').replace(
      /\/api\/?$/,
      '',
    );
    return `${apiBase}${url.startsWith('/') ? url : `/${url}`}`;
  }

  return PRODUCT_IMAGE_PLACEHOLDER;
}

function resolveCategoryName(p) {
  if (!p) return '';
  if (typeof p.categoryId === 'object' && p.categoryId?.name) return p.categoryId.name;
  return p.categoryName || '';
}

function resolveSubcategoryName(p) {
  if (!p) return '';
  if (typeof p.subcategoryId === 'object' && p.subcategoryId?.name) {
    return p.subcategoryId.name;
  }
  return p.subcategoryName || '';
}

function resolveVariantLabel(p, variants, minSell, maxSell) {
  if (p.variantLabel) return p.variantLabel;
  if (variants.length === 1) {
    return variants[0].name || null;
  }
  if (variants.length > 1) {
    if (minSell !== maxSell) {
      return `${variants.length} options · from ₹${minSell.toLocaleString('en-IN')}`;
    }
    return `${variants.length} sizes`;
  }
  return null;
}

function resolveFulfillmentLabel(source) {
  if (source === 'hub') return 'Hub stock';
  if (source === 'seller') return 'Vendor stock';
  if (source === 'hybrid') return 'Hub + vendor';
  return '';
}

function resolveStockQty(p, variants) {
  const totalAvailableQty = Number(p.totalAvailableQty);
  if (Number.isFinite(totalAvailableQty) && totalAvailableQty >= 0) return totalAvailableQty;
  return 0;
}

export function normalizeCustomerProduct(p) {
  if (!p || typeof p !== 'object') return p;

  const variants = Array.isArray(p.variants) ? p.variants : [];
  const sellPrices = variants
    .map((v) => Number(v.salePrice ?? v.price) || 0)
    .filter((n) => n > 0);

  let price = Number(p.salePrice ?? p.displayPrice ?? p.price) || 0;
  let originalPrice = Number(p.price) || price;
  let weight = p.weight || p.unit || '1 pc';

  const categoryName = resolveCategoryName(p);
  const subcategoryName = resolveSubcategoryName(p);
  const brand = p.brand || '';
  const unit = p.unit || variants[0]?.unit || '';
  const fulfillmentLabel = resolveFulfillmentLabel(p.fulfillmentSource);
  const stockQty = resolveStockQty(p, variants);

  if (variants.length > 0) {
    const first = variants[0];
    const firstSale = Number(first.salePrice ?? first.price) || 0;
    const firstMrp = Number(first.price) || firstSale;
    const minSell = sellPrices.length ? Math.min(...sellPrices) : firstSale;
    const maxSell = sellPrices.length ? Math.max(...sellPrices) : firstSale;

    price = minSell;
    originalPrice = firstMrp;
    weight = first.name ? String(first.name) : weight;

    const variantLabel = resolveVariantLabel(p, variants, minSell, maxSell);
    const hasMultipleVariants =
      p.hasMultipleVariants === true || variants.length > 1;

    return {
      ...p,
      id: p._id || p.id,
      _id: p._id || p.id,
      image: resolveProductImageUrl(p),
      price,
      originalPrice: originalPrice > price ? originalPrice : firstMrp,
      displayPrice: p.displayPrice ?? minSell,
      displayPriceMax: p.displayPriceMax ?? maxSell,
      variantCount: p.variantCount ?? variants.length,
      hasMultipleVariants,
      variantLabel,
      weight,
      brand,
      unit,
      categoryName,
      subcategoryName,
      fulfillmentLabel,
      stockQty,
      inStock: stockQty > 0,
      variants,
    };
  }

  const variantLabel = p.variantLabel || null;

  return {
    ...p,
    id: p._id || p.id,
    _id: p._id || p.id,
    image: resolveProductImageUrl(p),
    price,
    originalPrice,
    displayPrice: p.displayPrice ?? price,
    displayPriceMax: p.displayPriceMax ?? price,
    weight,
    brand,
    unit,
    categoryName,
    subcategoryName,
    fulfillmentLabel,
    stockQty,
    variantCount: 0,
    hasMultipleVariants: false,
    variantLabel,
    inStock: stockQty > 0,
    variants: [],
  };
}

export function normalizeCustomerProducts(raw = []) {
  return (Array.isArray(raw) ? raw : []).map(normalizeCustomerProduct);
}
