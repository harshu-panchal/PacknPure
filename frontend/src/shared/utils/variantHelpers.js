/** Shared variant + cart key helpers for customer catalog UI. */

export function resolveVariantKey(v) {
  return v?._id || v?.id || v?.sku || v?.name;
}

export function getVariantId(v) {
  if (!v) return "";
  const id = v._id || v.id;
  return id ? String(id) : "";
}

export function cartKey(productId, variantId) {
  return `${String(productId || "").trim()}::${variantId ? String(variantId).trim() : ""}`;
}

export function getVariantPricing(v) {
  const sale = Number(v?.salePrice ?? v?.price) || 0;
  const mrp = Number(v?.price) || sale;
  const savings = Math.max(0, mrp - sale);
  const discountPct = mrp > 0 ? Math.round((savings / mrp) * 100) : 0;
  return { sale, mrp, savings, discountPct };
}

function readRawVariantStock(v) {
  if (v?.totalAvailableQty !== undefined || v?.availableQty !== undefined || v?.stockQty !== undefined) {
    return Math.max(
      0,
      Number(v?.totalAvailableQty ?? v?.availableQty ?? v?.stockQty ?? 0) || 0,
    );
  }
  const stock = Number(v?.stock) || 0;
  const committed = Number(v?.committedStock) || 0;
  if (v?.committedStock != null) {
    return Math.max(0, stock - committed);
  }
  return Math.max(
    0,
    stock,
  );
}

export function getVariantStockBreakdown(v) {
  const hasSplit =
    v?.adminStock != null ||
    v?.hubStock != null ||
    v?.sellerStock != null ||
    v?.sellerAvailableStock != null ||
    v?.availableQtySeller != null;

  if (hasSplit) {
    const admin = Math.max(
      0,
      Number(v?.adminStock ?? v?.hubStock ?? v?.availableQtyHub ?? 0) || 0,
    );
    const seller = Math.max(
      0,
      Number(v?.sellerAvailableStock ?? v?.availableQtySeller ?? v?.sellerStock ?? 0) || 0,
    );
    const total = admin + seller;
    return {
      admin,
      seller,
      total,
      hasSplit: true,
    };
  }

  const total = readRawVariantStock(v);
  return { admin: total, seller: 0, total, hasSplit: false };
}

export function getVariantStock(v) {
  return getVariantStockBreakdown(v).total;
}

export function isVariantInStock(v) {
  return getVariantStock(v) > 0;
}

/** Build map variantId -> quantity for a product from cart items. */
export function buildVariantCartMap(cart, productId) {
  const map = new Map();
  if (!productId || !Array.isArray(cart)) return map;
  const pid = String(productId);
  cart.forEach((item) => {
    if (String(item.productId || item.id || item._id) !== pid) return;
    const vId = String(item.variantId || item.selectedVariantId || "");
    map.set(vId, (map.get(vId) || 0) + (Number(item.quantity) || 0));
  });
  return map;
}

export function pickDefaultVariant(variants = []) {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants.find(isVariantInStock) || variants[0];
}

export function resolveCartStockQty(product, variantId = null) {
  if (!product) return 0;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const vId = variantId ? String(variantId) : "";
  const variant =
    (vId && variants.find((row) => getVariantId(row) === vId)) ||
    variants[0] ||
    null;

  if (variant) {
    return getVariantStock(variant);
  }

  if (
    product.totalAvailableQty !== undefined ||
    product.availableQtyHub !== undefined ||
    product.availableQtySeller !== undefined
  ) {
    const hub = Number(product.availableQtyHub ?? 0) || 0;
    const seller = Number(product.availableQtySeller ?? 0) || 0;
    const total = Number(product.totalAvailableQty ?? hub + seller) || 0;
    return Math.max(0, total);
  }

  return Math.max(
    0,
    Number(
      product.stockQty ??
        product.totalAvailableQty ??
        product.availableQty ??
        product.stock ??
        0,
    ) || 0,
  );
}

export function applySelectedVariant(product, variant) {
  if (!product) return null;
  const targetVariant = variant || (Array.isArray(product.variants) && product.variants.length > 0 ? product.variants[0] : null);
  
  if (!targetVariant) return product;
  
  const { sale, mrp } = getVariantPricing(targetVariant);
  const totalStock = getVariantStock(targetVariant);
  
  return {
    ...product,
    selectedVariantId: getVariantId(targetVariant),
    price: mrp,
    salePrice: sale,
    originalPrice: mrp,
    weight: targetVariant.name || product.weight,
    variantLabel: targetVariant.name || product.variantLabel,
    unit: targetVariant.unit || product.unit,
    stockQty: totalStock,
    inStock: totalStock > 0,
    averageRating: targetVariant.averageRating ?? product.averageRating,
    totalReviews: targetVariant.totalReviews ?? product.totalReviews,
    ratingDistribution: targetVariant.ratingDistribution ?? product.ratingDistribution,
  };
}
// for product detail page
