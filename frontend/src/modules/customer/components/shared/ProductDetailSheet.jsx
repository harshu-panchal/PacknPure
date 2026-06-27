import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { X, Heart, Share2, Minus, Plus, Package, Loader2, ChevronRight, Star, ChevronLeft, Trash2 } from 'lucide-react';
import { useProductDetail } from '../../context/ProductDetailContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@/lib/utils';
import {
  resolveVariantKey,
  getVariantId,
  cartKey,
  getVariantPricing,
  getVariantStock,
  isVariantInStock,
  buildVariantCartMap,
  pickDefaultVariant,
  applySelectedVariant,
} from '@shared/utils/variantHelpers';
import { getUnitLabel } from '@shared/constants/productUnits';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=400&h=400&fit=crop';

function cleanDescription(text) {
  if (!text) return null;
  const t = String(text);
  if (t.trim().startsWith('{\\rtf') || t.includes('\\par')) {
    return t
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/\\[a-z]+\d*\s?/gi, '')
      .replace(/[{}]/g, '')
      .replace(/\\'/g, "'")
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return t;
}

function formatInr(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export function ProductImageGallery({ images, name, activeIndex, onSelect, fullFrame = false }) {
  // Auto-slide functionality
  useEffect(() => {
    if (!images || images.length <= 1) return;
    const interval = setInterval(() => {
      onSelect((prev) => (prev + 1) % images.length);
    }, 5000); // Slides every 5 seconds
    return () => clearInterval(interval);
  }, [images, onSelect]);

  const handlePrev = (e) => {
    e.stopPropagation();
    onSelect((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    onSelect((prev) => (prev + 1) % images.length);
  };

  return (
    <div className="flex h-full flex-col justify-center relative group">
      <div className={cn("flex items-center justify-center relative", fullFrame ? "p-0" : "p-4 sm:p-6 lg:p-10")}>
        {/* Added border, shadow, and frame */}
        <div className={cn(
          "relative flex items-center justify-center overflow-hidden bg-white transition-all",
          fullFrame ? "aspect-[4/5] sm:aspect-square w-full" : "aspect-square w-full max-w-[320px] sm:max-w-[380px] rounded-3xl border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.08)] ring-1 ring-slate-900/5"
        )}>
          <AnimatePresence mode="wait">
            <motion.img
              key={activeIndex}
              src={images[activeIndex]}
              alt={name || 'Product'}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="absolute inset-0 h-full w-full object-cover object-top mix-blend-multiply"
            />
          </AnimatePresence>

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/80 shadow-md backdrop-blur-sm transition-all hover:bg-white hover:scale-110 opacity-0 group-hover:opacity-100 z-20"
                aria-label="Previous image"
              >
                <ChevronLeft size={20} className="text-slate-800" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/80 shadow-md backdrop-blur-sm transition-all hover:bg-white hover:scale-110 opacity-0 group-hover:opacity-100 z-20"
                aria-label="Next image"
              >
                <ChevronRight size={20} className="text-slate-800" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dots Indicator - Between main image and thumbnails */}
      {images.length > 1 && (
        <div className="flex justify-center items-center gap-2 py-4">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(i);
              }}
              className={cn(
                "transition-all duration-300 rounded-full",
                i === activeIndex
                  ? "bg-[#E23744] h-2 w-4"
                  : "bg-slate-300 h-2 w-2 hover:bg-slate-400"
              )}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Responsive thumbnails */}
      {images.length > 1 && (
        <div className="flex justify-center gap-2 sm:gap-3 overflow-x-auto px-4 pb-4 sm:pb-6 scrollbar-hide">
          {images.slice(0, 6).map((img, i) => (
            <button
              key={img + i}
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                'shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-all duration-300',
                // Responsive sizes: slightly larger
                'h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16',
                i === activeIndex
                  ? 'border-[#E23744] shadow-md scale-105 z-10'
                  : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105',
              )}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VariantPicker({ variants, selectedKey, onSelect, variantCartMap }) {
  const multi = variants.length > 1;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {multi ? 'Choose size / pack' : 'Pack details'}
        </p>
        {multi ? (
          <span className="text-[11px] font-medium text-slate-400">
            {variants.length} options
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          multi
            ? 'flex gap-2 overflow-x-auto py-1 scrollbar-hide -mx-1 px-1'
            : 'grid grid-cols-1',
        )}
      >
        {variants.map((v) => {
          const key = resolveVariantKey(v);
          const active = key === selectedKey;
          const { sale, mrp, savings, discountPct } = getVariantPricing(v);
          const stock = getVariantStock(v);
          const inStock = stock > 0;
          const vId = getVariantId(v);
          const inCartQty = variantCartMap.get(vId) || 0;

          return (
            <button
              key={String(key)}
              type="button"
              disabled={!inStock}
              onClick={() => onSelect(key)}
              className={cn(
                'relative shrink-0 rounded-xl border text-left transition-all',
                multi ? 'min-w-[132px] px-3 py-2.5' : 'p-3.5',
                active
                  ? 'border-brand-600 bg-brand-50 shadow-sm ring-1 ring-brand-200'
                  : inStock
                    ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60',
              )}
            >
              {inCartQty > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white shadow">
                  {inCartQty}
                </span>
              ) : null}

              <p
                className={cn(
                  'text-sm font-bold leading-tight',
                  active ? 'text-brand-700' : 'text-slate-900',
                )}
              >
                {v.name}
              </p>

              {v.unit ? (
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{getUnitLabel(v.unit)}</p>
              ) : null}

              <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
                <span className="text-sm font-black text-slate-900">{formatInr(sale)}</span>
                {mrp > sale && inStock ? (
                  <span className="text-[10px] font-semibold text-slate-400 line-through">
                    {formatInr(mrp)}
                  </span>
                ) : null}
              </div>

              <p
                className={cn(
                  'mt-1 text-[10px] font-semibold',
                  inStock ? 'text-emerald-700' : 'text-slate-400',
                )}
              >
                {inStock ? `${stock} in stock` : 'Out of stock'}
              </p>

              {discountPct > 0 && inStock ? (
                <span className="mt-1.5 inline-block rounded-md bg-[#E23744] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                  {discountPct}% off
                </span>
              ) : null}

              {!multi && savings > 0 && inStock ? (
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  Save {formatInr(savings)}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}



function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return undefined;

    const scrollY = window.scrollY;
    const { body, documentElement: html } = document;
    const prevBody = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    const prevHtmlOverflow = html.style.overflow;

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';

    return () => {
      body.style.position = prevBody.position;
      body.style.top = prevBody.top;
      body.style.left = prevBody.left;
      body.style.right = prevBody.right;
      body.style.width = prevBody.width;
      body.style.overflow = prevBody.overflow;
      html.style.overflow = prevHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

const CTA_RED = '#E23744';

function QuantityControls({
  quantity,
  inStock,
  maxQty,
  onAdd,
  onInc,
  onDec,
  onSet,
  compact,
}) {
  const [inputValue, setInputValue] = useState(String(quantity));

  useEffect(() => {
    setInputValue(String(quantity));
  }, [quantity]);

  useEffect(() => {
    if (!onSet) return;
    const val = parseInt(inputValue, 10);
    if (!isNaN(val) && val >= 1 && val !== quantity) {
      const timer = setTimeout(async () => {
        const res = await onSet(val);
        if (res === false) {
          setInputValue(String(quantity));
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [inputValue, quantity, onSet]);

  const atMax = maxQty != null && quantity >= maxQty;

  const handleMinus = () => {
    if (onDec) onDec();
  };

  if (quantity > 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-between rounded-2xl text-white shadow-lg',
          compact ? 'h-12 w-[140px] px-2' : 'min-w-[200px] px-2 py-1.5',
        )}
        style={{
          backgroundColor: CTA_RED,
          boxShadow: '0 8px 24px rgba(226, 55, 68, 0.35)',
        }}
      >
        <button
          type="button"
          onClick={handleMinus}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 active:bg-white/30 shrink-0"
          aria-label={quantity === 1 ? "Remove" : "Decrease"}
        >
          {quantity === 1 ? <Trash2 size={18} strokeWidth={2.5} /> : <Minus size={20} strokeWidth={3} />}
        </button>
        <input
          type="number"
          min="1"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={() => {
            const val = parseInt(inputValue, 10);
            if (isNaN(val) || val < 1) {
              setInputValue(String(quantity));
            }
          }}
          className="w-12 bg-transparent text-center text-lg font-black border-none outline-none [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none text-white"
        />
        <button
          type="button"
          onClick={onInc}
          disabled={!inStock || atMax}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 active:bg-white/30',
            (!inStock || atMax) && 'cursor-not-allowed opacity-40',
          )}
          aria-label="Increase"
        >
          <Plus size={20} strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={!inStock}
      className={cn(
        'rounded-2xl font-black uppercase tracking-wide text-white shadow-lg transition-transform active:scale-[0.98]',
        inStock ? 'hover:opacity-95' : 'cursor-not-allowed bg-slate-300 shadow-none',
        compact ? 'h-12 w-[140px] text-sm' : 'px-10 py-4 text-sm',
      )}
      style={
        inStock
          ? {
            backgroundColor: CTA_RED,
            boxShadow: '0 8px 28px rgba(226, 55, 68, 0.4)',
          }
          : undefined
      }
    >
      {inStock ? 'Add to cart' : 'Out of stock'}
    </button>
  );
}

function ProductDetailFooter({
  effectiveProduct,
  quantity,
  inStock,
  maxQty,
  cartCount,
  cart,
  onAdd,
  onInc,
  onDec,
  onSet,
  onClose,
  compact,
}) {
  const { sale, mrp, savings } = getVariantPricing(effectiveProduct);

  const effectiveQty = Math.max(1, quantity || 1);
  const displaySale = sale * effectiveQty;
  const displayMrp = mrp * effectiveQty;
  const displaySavings = savings * effectiveQty;

  return (
    <div
      className={cn(
        'relative z-10 shrink-0 border-t-2 border-slate-100 bg-white',
        compact
          ? 'px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(15,23,42,0.15)]'
          : 'p-6 shadow-[0_-8px_30px_rgba(15,23,42,0.08)]',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {!compact ? (
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Price for selected pack</p>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{formatInr(displaySale)}</span>
              {displayMrp > displaySale ? (
                <span className="text-sm text-slate-400 line-through">{formatInr(displayMrp)}</span>
              ) : null}
            </div>
            {displaySavings > 0 ? (
              <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                Save {formatInr(displaySavings)}
              </p>
            ) : null}
            {maxQty != null && inStock ? (
              <p className="mt-1 text-[11px] text-slate-400">Max {maxQty} per order</p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p>
              <span className="text-xl font-black text-slate-900">{formatInr(displaySale)}</span>
            </div>
            {displayMrp > displaySale ? (
              <span className="text-xs font-semibold text-slate-400 line-through">{formatInr(displayMrp)}</span>
            ) : null}
          </div>
        )}

        <div className="shrink-0">
          <QuantityControls
            quantity={quantity}
            inStock={inStock}
            maxQty={maxQty}
            onAdd={onAdd}
            onInc={onInc}
            onDec={onDec}
            onSet={onSet}
            compact={compact}
          />
        </div>
      </div>

      {cartCount > 0 ? (
        <div className="flex justify-end mt-3">
          <Link
            to="/cart"
            onClick={onClose}
            style={{
              backgroundColor: "var(--customer-mini-cart-color, #E23744)",
            }}
            className="flex w-full max-w-[148px] items-center gap-2 text-white py-1.5 px-2.5 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.22)] hover:scale-[1.02] active:scale-95 transition-all group border border-white/10 relative overflow-hidden"
          >
            <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
              <div className="mini-cart-shimmer absolute inset-y-0 left-[-40%] w-[40%] bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg]" />
            </div>

            <div className="h-7 w-7 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
              {cart && cart.length > 0 && (
                <img
                  src={cart[0].image}
                  alt={cart[0].name}
                  className="w-full h-full object-contain p-0.5"
                />
              )}
            </div>

            <div className="flex-1 flex flex-col justify-center min-w-0 text-left">
              <h4 className="text-[12px] font-black leading-tight truncate">View cart</h4>
              <p className="text-[9px] opacity-90 font-bold leading-tight">{cartCount} {cartCount === 1 ? 'item' : 'items'}</p>
            </div>

            <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <ChevronRight size={15} strokeWidth={3} className="text-white" />
            </div>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

const ProductDetailSheet = () => {
  const { selectedProduct, isOpen, isRefreshing, closeProduct } = useProductDetail();
  const { cart, cartCount, addToCart, updateQuantity, removeFromCart } = useCart();
  const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
  const { showToast } = useToast();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariantKey, setSelectedVariantKey] = useState(null);

  const variants = useMemo(
    () => (Array.isArray(selectedProduct?.variants) ? selectedProduct.variants : []),
    [selectedProduct?.variants],
  );
  const hasVariants = variants.length > 0;

  useEffect(() => {
    setActiveImageIndex(0);
    const pick = pickDefaultVariant(variants);
    setSelectedVariantKey(pick ? resolveVariantKey(pick) : null);
  }, [selectedProduct?.id, variants]);

  useLockBodyScroll(isOpen);

  const images = useMemo(() => {
    if (!selectedProduct) return [];
    const out = [];
    if (selectedProduct.mainImage) out.push(selectedProduct.mainImage);
    else if (selectedProduct.image) out.push(selectedProduct.image);
    if (Array.isArray(selectedProduct.galleryImages)) {
      out.push(...selectedProduct.galleryImages.filter(Boolean));
    }
    return out.length ? out : [FALLBACK_IMAGE];
  }, [selectedProduct]);

  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    if (!selectedVariantKey) return variants[0];
    return variants.find((v) => resolveVariantKey(v) === selectedVariantKey) || variants[0];
  }, [hasVariants, variants, selectedVariantKey]);

  const effectiveProduct = useMemo(() => {
    if (!selectedProduct) return null;
    if (!selectedVariant) return selectedProduct;
    return applySelectedVariant(selectedProduct, selectedVariant);
  }, [selectedProduct, selectedVariant]);

  const productId = effectiveProduct?.id || effectiveProduct?._id;
  const selectedVariantId = selectedVariant ? getVariantId(selectedVariant) : '';

  const variantCartMap = useMemo(
    () => buildVariantCartMap(cart, productId),
    [cart, productId],
  );

  const cartItem = useMemo(() => {
    if (productId == null) return null;
    const key = cartKey(productId, selectedVariantId || null);
    return cart.find((item) => {
      const itemKey = cartKey(
        item.productId || item.id || item._id,
        item.variantId || item.selectedVariantId,
      );
      return itemKey === key;
    });
  }, [cart, productId, selectedVariantId]);

  const quantity = cartItem?.quantity || 0;
  const totalProductCartQty = useMemo(() => {
    let sum = 0;
    variantCartMap.forEach((qty) => {
      sum += qty;
    });
    if (!hasVariants && productId) {
      return quantity;
    }
    return sum;
  }, [variantCartMap, hasVariants, quantity, productId]);

  const variantsInCartCount = useMemo(() => {
    let count = 0;
    variantCartMap.forEach((qty) => {
      if (qty > 0) count += 1;
    });
    return count;
  }, [variantCartMap]);

  const isWishlisted = productId ? isInWishlist(productId) : false;
  const maxQty = effectiveProduct?.stockQty ?? null;
  const inStock =
    effectiveProduct?.inStock !== false &&
    (maxQty == null || Number(maxQty) > 0);

  const desc = cleanDescription(effectiveProduct?.description);
  const categoryLine = [effectiveProduct?.subcategoryName, effectiveProduct?.categoryName]
    .filter(Boolean)
    .join(' · ');

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: effectiveProduct?.name || 'Product',
          text: effectiveProduct?.name || 'Product',
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Link copied', 'success');
      }
    } catch {
      // ignore
    }
  };

  const toggleWishlist = (e) => {
    e?.stopPropagation?.();
    if (!effectiveProduct) return;
    toggleWishlistGlobal(effectiveProduct);
    showToast(
      isWishlisted ? 'Removed from wishlist' : 'Saved to wishlist',
      isWishlisted ? 'info' : 'success',
    );
  };

  const buildCartPayload = () => {
    const vId = selectedVariantId || null;
    return {
      ...effectiveProduct,
      selectedVariantId: vId,
      variantId: vId,
    };
  };

  const handleAdd = () => {
    if (!effectiveProduct || !inStock) return;
    if (hasVariants && !selectedVariantId) {
      showToast('Please select a pack size', 'info');
      return;
    }
    addToCart(buildCartPayload());
    const label = selectedVariant?.name ? ` (${selectedVariant.name})` : '';
    showToast(`${effectiveProduct.name}${label} added to cart`, 'success');
  };

  const inc = () => {
    if (!productId || !inStock) return;
    if (maxQty != null && quantity >= maxQty) {
      showToast(`Only ${maxQty} available for this pack`, 'info');
      return;
    }
    updateQuantity(productId, 1, selectedVariantId || undefined);
  };

  const dec = () => {
    if (!productId) return;
    const vId = selectedVariantId || undefined;
    if (quantity <= 1) removeFromCart(productId, vId);
    else updateQuantity(productId, -1, vId);
  };

  const setQty = (val) => {
    if (!productId) return;
    const vId = selectedVariantId || undefined;
    return updateQuantity(productId, val - quantity, vId);
  };

  if (!selectedProduct) return null;

  const headerBadges = (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {effectiveProduct?.brand ? (
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
          {effectiveProduct.brand}
        </span>
      ) : null}
      {effectiveProduct?.fulfillmentLabel ? (
        <span className="rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">
          {effectiveProduct.fulfillmentLabel}
        </span>
      ) : null}
      {!inStock ? (
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
          Out of stock
        </span>
      ) : null}
      {isRefreshing ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
          <Loader2 size={11} className="animate-spin" />
          Updating
        </span>
      ) : null}
      {effectiveProduct?.gstEnabled === true ? (
        <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 border border-amber-200">
          GST Inclusive
        </span>
      ) : null}
    </div>
  );

  const variantSection = hasVariants ? (
    <div className="space-y-3">
      <VariantPicker
        variants={variants}
        selectedKey={selectedVariantKey}
        onSelect={setSelectedVariantKey}
        variantCartMap={variantCartMap}
      />
      {totalProductCartQty > 0 && variantsInCartCount > 1 ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">
          {totalProductCartQty} items in cart across {variantsInCartCount} pack sizes
        </p>
      ) : null}
    </div>
  ) : null;

  const ratingVal = Number(effectiveProduct?.averageRating || 0);
  const reviewCount = Number(effectiveProduct?.totalReviews || 0);
  const productSlug = effectiveProduct?.slug || effectiveProduct?._id || effectiveProduct?.id || '';

  const aboutSection = (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Product Info & Rating</p>
        <Link
          to={`/product/${productSlug}${selectedVariantId ? `?variant=${selectedVariantId}` : ''}#reviews`}
          onClick={closeProduct}
          className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-100 hover:border-[#E23744]/30 hover:bg-[#E23744]/5 transition-colors"
        >
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={12} strokeWidth={1.5} className={i < Math.floor(ratingVal) ? "fill-[#E23744] text-black" : "fill-transparent text-black"} />
            ))}
          </div>
          <span className="text-xs font-black text-slate-800 ml-1">{Number(ratingVal).toFixed(1)}</span>
          <span className="text-[10px] font-bold text-slate-400">({reviewCount})</span>
        </Link>
      </div>

      {desc ? (
        <div className="pt-2 border-t border-slate-100/50">
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 font-medium">{desc}</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeProduct}
            onTouchMove={(e) => e.preventDefault()}
            className="fixed inset-0 z-[600] touch-none bg-black/60 backdrop-blur-sm"
            aria-hidden
          />

          {/* Desktop modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 24 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            className="fixed inset-0 z-[610] hidden items-center justify-center p-6 md:flex pointer-events-none"
          >
            <div
              className="pointer-events-auto flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid min-h-0 flex-1 grid-cols-2">
                <div className="relative border-r border-slate-100 bg-slate-50">
                  <div className="absolute left-4 top-4 z-10">
                    <button
                      type="button"
                      onClick={closeProduct}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm"
                      aria-label="Close"
                    >
                      <X size={18} className="text-slate-700" />
                    </button>
                  </div>
                  <ProductImageGallery
                    images={images}
                    name={effectiveProduct?.name}
                    activeIndex={activeImageIndex}
                    onSelect={setActiveImageIndex}
                  />
                </div>

                <div className="flex min-h-0 flex-col">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-6">
                    <div className="min-w-0">
                      {headerBadges}
                      <h2 className="line-clamp-2 text-xl font-bold text-slate-900">
                        {effectiveProduct?.name}
                      </h2>
                      {categoryLine ? (
                        <p className="mt-1 text-sm text-slate-500">{categoryLine}</p>
                      ) : null}
                      {!hasVariants && (effectiveProduct?.variantLabel || effectiveProduct?.unit) ? (
                        <p className="mt-1 text-sm font-semibold text-brand-600">
                          {[effectiveProduct?.variantLabel, effectiveProduct?.unit ? getUnitLabel(effectiveProduct?.unit) : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={share}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
                        aria-label="Share"
                      >
                        <Share2 size={18} className="text-slate-700" />
                      </button>
                      <button
                        type="button"
                        onClick={toggleWishlist}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg border',
                          isWishlisted
                            ? 'border-brand-200 bg-brand-50 text-brand-700'
                            : 'border-slate-200 hover:bg-slate-50',
                        )}
                        aria-label="Wishlist"
                      >
                        <Heart
                          size={18}
                          className={cn(
                            isWishlisted ? 'fill-brand-600 text-brand-600' : 'text-slate-500',
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-6">
                    {variantSection}
                    {aboutSection}
                  </div>

                  <ProductDetailFooter
                    effectiveProduct={effectiveProduct}
                    quantity={quantity}
                    inStock={inStock}
                    maxQty={maxQty}
                    cartCount={cartCount}
                    cart={cart}
                    onAdd={handleAdd}
                    onInc={inc}
                    onDec={dec}
                    onSet={setQty}
                    onClose={closeProduct}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Mobile bottom sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            className="fixed bottom-0 left-0 right-0 z-[610] md:hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid max-h-[90vh] grid-rows-[auto_1fr_auto] overflow-hidden rounded-t-3xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
                <div className="h-1.5 w-12 rounded-full bg-slate-200" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={toggleWishlist}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200"
                    aria-label="Wishlist"
                  >
                    <Heart
                      size={16}
                      className={cn(isWishlisted ? 'fill-[#E23744] text-[#E23744]' : 'text-slate-500')}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={share}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200"
                    aria-label="Share"
                  >
                    <Share2 size={16} className="text-slate-500" />
                  </button>
                  <button
                    type="button"
                    onClick={closeProduct}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white"
                    aria-label="Close"
                  >
                    <X size={18} className="text-slate-700" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                  <ProductImageGallery
                    images={images}
                    name={effectiveProduct?.name}
                    activeIndex={activeImageIndex}
                    onSelect={setActiveImageIndex}
                  />
                </div>

                <div className="mt-4">
                  {headerBadges}
                  <h2 className="text-lg font-bold text-slate-900">{effectiveProduct?.name}</h2>
                  {categoryLine ? (
                    <p className="mt-1 text-sm text-slate-500">{categoryLine}</p>
                  ) : null}

                  <div className="mt-4 space-y-4">
                    {variantSection}
                    {aboutSection}
                  </div>
                </div>
              </div>

              <ProductDetailFooter
                effectiveProduct={effectiveProduct}
                quantity={quantity}
                inStock={inStock}
                maxQty={maxQty}
                cartCount={cartCount}
                cart={cart}
                onAdd={handleAdd}
                onInc={inc}
                onDec={dec}
                onSet={setQty}
                onClose={closeProduct}
                compact
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProductDetailSheet;
