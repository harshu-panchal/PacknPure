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

export function getVariantStock(v) {
  return Math.max(
    0,
    Number(
      v?.totalAvailableQty ??
        v?.availableQty ??
        v?.stockQty ??
        v?.stock ??
        0,
    ) || 0,
  );
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

export function applySelectedVariant(product, variant) {
  if (!product) return null;
  const targetVariant = variant || (Array.isArray(product.variants) && product.variants.length > 0 ? product.variants[0] : null);
  
  if (!targetVariant) return product;
  
  const { sale, mrp } = getVariantPricing(targetVariant);
  const stock = getVariantStock(targetVariant);
  const totalStock = Math.max(
    0,
    Number(
      targetVariant?.totalAvailableQty ??
        targetVariant?.availableQty ??
        product?.totalAvailableQty ??
        product?.availableQty ??
        stock,
    ) || 0,
  );
  
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
