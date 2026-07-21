import React from 'react';
import { Heart, Minus, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { useProductDetail } from '../../context/ProductDetailContext';
import { getUnitLabel } from '@shared/constants/productUnits';

const BLINKIT_RED = '#E23744';

/**
 * Horizontal product row (Blinkit-style category listing).
 */
const CategoryProductRow = ({ product }) => {
  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showToast } = useToast();
  const { openProduct } = useProductDetail();
  const productId = product.id || product._id;
  const cartItem = cart.find(
    (item) =>
      String(item.productId || item.id || item._id) === String(productId) &&
      String(item.variantId || item.selectedVariantId || "") ===
        String(product.selectedVariantId || ""),
  );
  const quantity = cartItem?.quantity || 0;
  const wishlisted = isInWishlist(productId);

  const inStock = product.inStock !== false && (Number(product.stockQty ?? product.totalAvailableQty) || 0) > 0;
  const hasVariants = (product.variants?.length || 0) > 0;
  const mustPickVariant = hasVariants && (product.hasMultipleVariants || product.variants.length > 1);

  const unitLine = product.variantLabel
    ? product.variantLabel
    : product.weight
      ? String(product.weight)
      : product.unit
        ? `1 ${getUnitLabel(product.unit)}`
        : '1 pc';

  const showMrp = product.originalPrice > product.price;
  const perPc =
    Number(product.packSize) > 1
      ? product.price / Number(product.packSize)
      : null;

  const handleOpenDetail = () => openProduct?.(product);

  const handleAdd = (e) => {
    e.stopPropagation();
    if (!inStock) return;
    if (mustPickVariant) {
      handleOpenDetail();
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
        'relative bg-white border border-slate-100 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 mb-3 mx-2 overflow-hidden transition-all duration-300 active:scale-[0.98]',
        !inStock && 'opacity-95',
      )}
    >
      {!inStock && (
        <div className="px-3 py-1.5 bg-[#FFF5F5] text-[11px] font-semibold text-gray-600 border-b border-[#FFE4E4]">
          Out of stock.{' '}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              showToast('We will notify you when this is back', 'info');
            }}
            className="font-bold"
            style={{ color: BLINKIT_RED }}
          >
            Notify me
          </button>
        </div>
      )}

      <div className="flex gap-2 p-3 pr-2 min-h-[108px]">
        <button
          type="button"
          onClick={handleOpenDetail}
          className="flex-1 min-w-0 text-left flex flex-col pr-1"
        >
          <h3 className="text-[13px] font-semibold text-gray-900 leading-snug line-clamp-2 pr-6">
            {product.name}
          </h3>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5 line-clamp-1">
            {unitLine}
          </p>
          
          {product.gstEnabled === true && (
            <div className="mt-1">
              <span className="rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                GST Inclusive
              </span>
            </div>
          )}

          <div className="mt-auto pt-2 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span
                  className={cn(
                    'text-[15px] font-bold',
                    inStock ? 'text-gray-900' : 'text-gray-400',
                  )}
                >
                  {product.hasMultipleVariants && product.displayPrice != null
                    ? `From ₹${product.displayPrice.toLocaleString('en-IN')}`
                    : `₹${product.price.toLocaleString('en-IN')}`}
                </span>
                {showMrp && inStock && (
                  <span className="text-[11px] text-gray-400 line-through font-medium">
                    ₹{product.originalPrice.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              {perPc != null && perPc > 0 && (
                <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                  at ₹{perPc.toFixed(2)}/pc
                </p>
              )}
              {product.deliveryTime && inStock && (
                <p className="text-[10px] text-rose-700 font-semibold mt-0.5">
                  {product.deliveryTime}
                </p>
              )}
            </div>
          </div>
        </button>

        <div className="flex flex-col items-end justify-between shrink-0 w-[92px]">
          <button
            type="button"
            onClick={handleWishlist}
            className="p-1 rounded-full hover:bg-gray-50 z-10"
            aria-label="Wishlist"
          >
            <Heart
              size={18}
              className={cn(
                wishlisted ? 'fill-[#E23744] text-[#E23744]' : 'text-gray-400',
              )}
            />
          </button>

          <button
            type="button"
            onClick={handleOpenDetail}
            className="relative w-[88px] h-[72px] rounded-lg overflow-hidden bg-gray-50 border border-gray-100 mb-1"
          >
            <img
              src={product.image}
              alt=""
              className="w-full h-full object-contain p-1"
              loading="lazy"
            />
          </button>

          <div className="w-full flex justify-end">
            {quantity > 0 && !mustPickVariant ? (
              <div
                className="flex items-center rounded-lg border-2 min-w-[88px] justify-between px-0.5"
                style={{ borderColor: BLINKIT_RED }}
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
                  style={{ color: BLINKIT_RED }}
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
                  className="w-8 bg-transparent text-center text-[13px] font-bold border-none outline-none [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ color: BLINKIT_RED }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateQuantity(productId, 1, product.selectedVariantId);
                  }}
                  className="p-1.5"
                  style={{ color: BLINKIT_RED }}
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
                  'min-w-[88px] py-1.5 rounded-lg border-2 text-[13px] font-bold uppercase tracking-wide transition-colors',
                  inStock
                    ? 'bg-white hover:bg-[#FFF5F5]'
                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed',
                )}
                style={
                  inStock
                    ? { borderColor: BLINKIT_RED, color: BLINKIT_RED }
                    : undefined
                }
              >
                {mustPickVariant && inStock ? 'ADD' : 'ADD'}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default CategoryProductRow;
