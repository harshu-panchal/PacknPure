import React, { useState, useEffect } from 'react';
import { Heart, Minus, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { useProductDetail } from '../../context/ProductDetailContext';
import {
  PRODUCT_IMAGE_PLACEHOLDER,
  resolveProductImageUrl,
} from '@shared/utils/productDisplay';
import { getUnitLabel } from '@shared/constants/productUnits';

const ACCENT = '#E23744';

/**
 * Mobile landing product row — Blinkit-style; variant + price; no hub stock labels.
 */
const HomeProductCard = ({ product }) => {
  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
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
  const wishlisted = isInWishlist(productId);

  const inStock = product.inStock !== false;
  const variantCount = product.variants?.length || 0;
  const mustPickVariant =
    product.hasMultipleVariants &&
    (product.variantCount > 1 || variantCount > 1);
  const optionsSubLabel = mustPickVariant
    ? `${product.variantCount ?? variantCount} option${(product.variantCount ?? variantCount) === 1 ? '' : 's'}`
    : '';

  const unitLine =
    product.variantLabel ||
    product.weight ||
    (product.unit ? `1 ${getUnitLabel(product.unit)}` : null);

  const showMrp = Number(product.originalPrice) > Number(product.price);

  const [imageSrc, setImageSrc] = useState(() => resolveProductImageUrl(product));

  useEffect(() => {
    setImageSrc(resolveProductImageUrl(product));
  }, [product]);

  const handleOpen = () => openProduct?.(product);

  const handleAdd = (e) => {
    e.stopPropagation();
    if (!inStock) return;
    if (mustPickVariant) {
      openProduct?.(product);
      return;
    }
    addToCart(product);
    showToast(`${product.name} added to cart`, 'success');
  };

  const handleWishlist = (e) => {
    e.stopPropagation();
    toggleWishlist(product);
    showToast(
      wishlisted ? 'Removed from wishlist' : 'Saved to wishlist',
      wishlisted ? 'info' : 'success',
    );
  };

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm',
        !inStock && 'opacity-95',
      )}
    >
      {!inStock && (
        <div className="border-b border-rose-100 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
          Out of stock
        </div>
      )}

      <div className="flex min-h-[108px] gap-2 p-3 pr-2">
        <button
          type="button"
          onClick={handleOpen}
          className="flex min-w-0 flex-1 flex-col pr-1 text-left"
        >
          <h3 className="line-clamp-2 pr-6 text-[13px] font-semibold leading-snug text-slate-900">
            {product.name}
          </h3>

          {unitLine ? (
            <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-[#E23744]">
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

          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span
                  className={cn(
                    'text-[15px] font-bold',
                    inStock ? 'text-slate-900' : 'text-slate-400',
                  )}
                >
                  {product.hasMultipleVariants && product.displayPrice != null
                    ? `From ₹${Number(product.displayPrice).toLocaleString('en-IN')}`
                    : `₹${Number(product.price || product.displayPrice || 0).toLocaleString('en-IN')}`}
                </span>
                {showMrp && inStock ? (
                  <span className="text-[11px] font-medium text-slate-400 line-through">
                    ₹{Number(product.originalPrice).toLocaleString('en-IN')}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </button>

        <div className="flex w-[92px] shrink-0 flex-col items-end justify-between">
          <button
            type="button"
            onClick={handleWishlist}
            className="z-10 rounded-full p-1 hover:bg-slate-50"
            aria-label="Wishlist"
          >
            <Heart
              size={18}
              className={cn(
                wishlisted ? 'fill-[#E23744] text-[#E23744]' : 'text-slate-400',
              )}
            />
          </button>

          <button
            type="button"
            onClick={handleOpen}
            className="relative mb-1 h-[72px] w-[88px] overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
          >
            <img
              src={imageSrc}
              alt={product.name}
              className="h-full w-full object-contain p-1.5"
              loading="lazy"
              onError={() => setImageSrc(PRODUCT_IMAGE_PLACEHOLDER)}
            />
          </button>

          <div className="flex w-full justify-end">
            {quantity > 0 && !mustPickVariant ? (
              <div
                className="flex min-w-[88px] items-center justify-between rounded-lg border-2 px-0.5"
                style={{ borderColor: ACCENT }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (quantity <= 1)
                      removeFromCart(productId, product.selectedVariantId);
                    else
                      updateQuantity(productId, -1, product.selectedVariantId);
                  }}
                  className="p-1.5"
                  style={{ color: ACCENT }}
                >
                  {quantity === 1 ? <Trash2 size={13} strokeWidth={2.5} /> : <Minus size={14} strokeWidth={3} />}
                </button>
                <input
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                    if (val === '') {
                      updateQuantity(productId, 0 - quantity, product.selectedVariantId || undefined);
                    } else if (!isNaN(val)) {
                      updateQuantity(productId, val - quantity, product.selectedVariantId || undefined);
                    }
                  }}
                  className="w-8 bg-transparent text-center text-sm font-bold border-none outline-none [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ color: ACCENT }}
                />
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
                  'w-full rounded-lg border-2 py-2 text-xs font-bold uppercase tracking-wide',
                  inStock
                    ? 'border-[#E23744] bg-white text-[#E23744] hover:bg-rose-50'
                    : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300',
                )}
              >
                {mustPickVariant && inStock ? (
                  <span className="flex flex-col items-center leading-tight">
                    <span>ADD</span>
                    <span className="mt-0.5 text-[9px] font-semibold normal-case tracking-normal text-[#E23744]/80">
                      {optionsSubLabel}
                    </span>
                  </span>
                ) : (
                  'Add'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default HomeProductCard;
