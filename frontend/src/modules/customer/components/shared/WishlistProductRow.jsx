import React from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { useProductDetail } from '../../context/ProductDetailContext';
import { getUnitLabel } from '@shared/constants/productUnits';

const ACCENT = '#E23744';

function formatPrice(product) {
  if (product.hasMultipleVariants && product.displayPrice != null) {
    if (product.displayPriceMax > product.displayPrice) {
      return `₹${product.displayPrice.toLocaleString('en-IN')} – ₹${product.displayPriceMax.toLocaleString('en-IN')}`;
    }
    return `From ₹${product.displayPrice.toLocaleString('en-IN')}`;
  }
  return `₹${Number(product.price || 0).toLocaleString('en-IN')}`;
}

const WishlistProductRow = ({ product }) => {
  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { removeFromWishlist } = useWishlist();
  const { showToast } = useToast();
  const { openProduct } = useProductDetail();

  const productId = product.id || product._id;
  const cartItem = cart.find(
    (item) =>
      String(item.productId || item.id || item._id) === String(productId) &&
      String(item.variantId || item.selectedVariantId || '') ===
        String(product.selectedVariantId || ''),
  );
  const quantity = cartItem?.quantity || 0;

  const inStock =
    product.inStock !== false &&
    (Number(product.stockQty ?? product.totalAvailableQty) || 0) > 0;

  const variantCount = product.variants?.length || 0;
  const mustPickVariant =
    product.hasMultipleVariants && variantCount > 1;

  const unitLine =
    product.variantLabel ||
    product.weight ||
    (product.unit ? `1 ${getUnitLabel(product.unit)}` : null);

  const showMrp = Number(product.originalPrice) > Number(product.price);

  const handleOpenDetail = () => openProduct?.(product);

  const handleAdd = (e) => {
    e.stopPropagation();
    if (!inStock) return;
    if (mustPickVariant) {
      handleOpenDetail();
      return;
    }
    const singleVariant = variantCount === 1 ? product.variants[0] : null;
    const variantId = singleVariant?._id || singleVariant?.id;
    addToCart({
      ...product,
      ...(variantId
        ? { selectedVariantId: String(variantId), variantId: String(variantId) }
        : {}),
    });
    showToast(`${product.name} added to cart`, 'success');
  };

  const handleRemove = async (e) => {
    e.stopPropagation();
    await removeFromWishlist(productId);
    showToast('Removed from your list', 'info');
  };

  return (
    <article
      className={cn(
        'group relative flex gap-3 border-b border-slate-100 bg-white p-3 last:border-b-0',
        !inStock && 'bg-slate-50/80',
      )}
    >
      <button
        type="button"
        onClick={handleOpenDetail}
        className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
      >
        <img
          src={product.image || product.mainImage}
          alt=""
          className="h-full w-full object-contain p-1.5 mix-blend-multiply"
          loading="lazy"
        />
        {!inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-slate-900/70 py-0.5 text-center text-[9px] font-bold uppercase text-white">
            Out of stock
          </span>
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={handleOpenDetail} className="min-w-0 flex-1 text-left">
            {product.brand ? (
              <span className="mb-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600">
                {product.brand}
              </span>
            ) : null}
            <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">
              {product.name}
            </h3>
            {unitLine ? (
              <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-slate-500">
                {unitLine}
              </p>
            ) : null}
            {product.gstEnabled === true && (
              <div className="mt-1">
                <span className="rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                  GST Inclusive
                </span>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={handleRemove}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-[#E23744]"
            aria-label="Remove from wishlist"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span
                className={cn(
                  'text-[15px] font-bold',
                  inStock ? 'text-slate-900' : 'text-slate-400',
                )}
              >
                {formatPrice(product)}
              </span>
              {showMrp && inStock ? (
                <span className="text-[11px] font-medium text-slate-400 line-through">
                  ₹{Number(product.originalPrice).toLocaleString('en-IN')}
                </span>
              ) : null}
            </div>
          </div>

          <div className="shrink-0">
            {quantity > 0 && !mustPickVariant ? (
              <div
                className="flex min-w-[92px] items-center justify-between rounded-lg border-2 px-0.5 py-0.5"
                style={{ borderColor: ACCENT }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (quantity <= 1) {
                      removeFromCart(productId, product.selectedVariantId);
                    } else {
                      updateQuantity(productId, -1, product.selectedVariantId);
                    }
                  }}
                  className="p-1.5"
                  style={{ color: ACCENT }}
                >
                  {quantity === 1 ? <Trash2 size={13} strokeWidth={2.5} /> : <Minus size={14} strokeWidth={3} />}
                </button>
                <span className="min-w-[20px] text-center text-[13px] font-bold" style={{ color: ACCENT }}>
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateQuantity(productId, 1, product.selectedVariantId);
                  }}
                  className="p-1.5"
                  style={{ color: ACCENT }}
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!inStock}
                onClick={handleAdd}
                className={cn(
                  'min-w-[92px] rounded-lg border-2 py-1.5 text-[12px] font-bold uppercase tracking-wide',
                  inStock
                    ? 'bg-white hover:bg-rose-50'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400',
                )}
                style={
                  inStock ? { borderColor: ACCENT, color: ACCENT } : undefined
                }
              >
                {mustPickVariant && inStock ? 'Options' : inStock ? 'Add' : 'Notify'}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default WishlistProductRow;
