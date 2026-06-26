import React from "react";
import { Heart, Plus, Minus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "@shared/components/ui/Toast";
import { useCartAnimation } from "../../context/CartAnimationContext";

import { motion, AnimatePresence } from "framer-motion";

import { useProductDetail } from "../../context/ProductDetailContext";
import {
  PRODUCT_IMAGE_PLACEHOLDER,
  resolveProductImageUrl,
} from "@shared/utils/productDisplay";
import { getUnitLabel } from "@shared/constants/productUnits";

const ProductCard = React.memo(
  ({
    product,
    badge,
    className,
    compact = false,
    neutralBg = false,
    showFulfillment = true,
    showStockInfo = true,
    imageBlend = true,
  }) => {
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } =
      useWishlist();
    const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
    const { showToast } = useToast();
    const { animateAddToCart, animateRemoveFromCart } = useCartAnimation();

    const { openProduct } = useProductDetail();
    const [showHeartPopup, setShowHeartPopup] = React.useState(false);

    const imageRef = React.useRef(null);
    const [imageSrc, setImageSrc] = React.useState(() =>
      resolveProductImageUrl(product),
    );

    React.useEffect(() => {
      setImageSrc(resolveProductImageUrl(product));
    }, [product]);

    const targetVariantId = product.selectedVariantId || product.variants?.[0]?._id || product.variants?.[0]?.id;
    
    const cartItem = React.useMemo(
      () =>
        cart.find(
          (item) =>
            String(item.productId || item.id || item._id) ===
              String(product.id || product._id) &&
            String(item.variantId || item.selectedVariantId || "") ===
              String(targetVariantId || ""),
        ),
      [cart, product.id, product._id, targetVariantId],
    );
    const quantity = cartItem ? cartItem.quantity : 0;
    const isWishlisted = isInWishlist(product.id || product._id);
    const variantCount = product.variants?.length || 0;
    const mustPickVariant = product.hasMultipleVariants && variantCount > 1;
    const optionsSubLabel = mustPickVariant
      ? `${product.variantCount ?? variantCount} option${(product.variantCount ?? variantCount) === 1 ? "" : "s"}`
      : "";

    const handleProductClick = React.useCallback(
      (e) => {
        if (openProduct) {
          e.preventDefault();
          openProduct(product);
        }
      },
      [openProduct, product],
    );

    const toggleWishlist = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isWishlisted) {
          setShowHeartPopup(true);
          setTimeout(() => setShowHeartPopup(false), 1000);
        }

        toggleWishlistGlobal(product);
        showToast(
          isWishlisted
            ? `${product.name} removed from wishlist`
            : `${product.name} added to wishlist`,
          isWishlisted ? "info" : "success",
        );
      },
      [isWishlisted, toggleWishlistGlobal, product, showToast],
    );

    const handleAddToCart = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (product.inStock === false) return;
        
        if (imageRef.current) {
          animateAddToCart(
            imageRef.current.getBoundingClientRect(),
            product.image,
          );
        }
        addToCart({
          ...product,
          ...(targetVariantId
            ? {
                selectedVariantId: String(targetVariantId),
                variantId: String(targetVariantId),
              }
            : {}),
        });
      },
      [animateAddToCart, product, addToCart, targetVariantId],
    );

    const handleIncrement = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateQuantity(
          product.id || product._id,
          1,
          targetVariantId ? String(targetVariantId) : undefined,
        );
      },
      [updateQuantity, product.id, product._id, targetVariantId],
    );

    const handleDecrement = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (quantity === 1) {
          animateRemoveFromCart(product.image);
          removeFromCart(
            product.id || product._id,
            targetVariantId ? String(targetVariantId) : undefined,
          );
        } else {
          updateQuantity(
            product.id || product._id,
            -1,
            targetVariantId ? String(targetVariantId) : undefined,
          );
        }
      },
      [
        quantity,
        animateRemoveFromCart,
        product.image,
        removeFromCart,
        product.id,
        product._id,
        targetVariantId,
        updateQuantity,
      ],
    );

    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        className={cn(
          "shrink-0 w-full rounded-2xl overflow-hidden flex flex-col h-full shadow-sm cursor-pointer transition-all duration-300",
          compact
            ? "bg-white border border-slate-100 shadow-sm"
            : neutralBg
              ? "bg-white border border-slate-100 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)]"
              : "bg-white border border-slate-100",
          className,
        )}
        onClick={handleProductClick}>
        {/* Top Image Section */}
        <div className={cn("relative pb-0", compact ? "p-2" : "p-2.5")}>
          {/* Badge (Custom or Discount) */}
          {(badge ||
            product.discount ||
            product.originalPrice > product.price) && (
            <div
              className={cn(
                "absolute z-10 bg-[#E23744] text-white font-black rounded-md shadow-sm uppercase tracking-wider flex items-center justify-center",
                compact
                  ? "top-2 left-2 px-1.5 py-0.5 text-[7px]"
                  : "top-3 left-3 px-2 py-1 text-[9px]",
              )}>
              {badge ||
                product.discount ||
                `${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF`}
            </div>
          )}

          <button
            onClick={toggleWishlist}
            className={cn(
              "absolute z-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-white transition-all active:scale-90",
              compact ? "top-2 right-2 h-7 w-7" : "top-3 right-3 h-8 w-8",
            )}>
            <motion.div
              whileTap={{ scale: 0.8 }}
              animate={isWishlisted ? { scale: [1, 1.2, 1] } : {}}>
              <Heart
                size={compact ? 13 : 16}
                className={cn(
                  isWishlisted
                    ? "text-red-500 fill-current"
                    : "text-neutral-400",
                )}
              />
            </motion.div>
          </button>

          <AnimatePresence>
            {showHeartPopup && (
              <motion.div
                initial={{ scale: 0.5, opacity: 1, y: 0 }}
                animate={{ scale: 2, opacity: 0, y: -40 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute top-3 right-3 z-50 pointer-events-none text-red-500">
                <Heart size={24} fill="currentColor" />
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className={cn(
              "flex aspect-square w-full items-center justify-center overflow-hidden p-2 transition-transform duration-500 group-hover:scale-105",
              compact || neutralBg
                ? "rounded-xl bg-white/70"
                : "rounded-xl bg-white/50",
            )}>
            <img
              ref={imageRef}
              src={imageSrc}
              alt={product.name}
              className={cn(
                "h-full w-full object-contain drop-shadow-sm",
                imageBlend && "mix-blend-multiply",
              )}
              loading="lazy"
              onError={() => setImageSrc(PRODUCT_IMAGE_PLACEHOLDER)}
            />
          </div>
        </div>

        {/* Info Section */}
        <div
          className={cn(
            "flex flex-col flex-1",
            compact ? "gap-1 p-3 pt-2" : "bg-white/40 p-3 pt-4 gap-0.5",
          )}>
          <div className="mb-1 flex flex-wrap items-center gap-1">
            {product.brand ? (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                {product.brand}
              </span>
            ) : null}
            {showFulfillment && product.fulfillmentLabel ? (
              <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold text-brand-700">
                {product.fulfillmentLabel}
              </span>
            ) : null}
            {!product.inStock && (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                Out of stock
              </span>
            )}
            {product.gstEnabled === true && (
              <span className="rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                GST Inclusive
              </span>
            )}
          </div>

          <h4
            className={cn(
              "font-semibold text-slate-900 leading-tight line-clamp-2",
              compact ? "text-[12px] min-h-10" : "text-[13px] min-h-9",
            )}>
            {product.name}
          </h4>

          {(product.subcategoryName || product.categoryName) && (
            <p
              className={cn(
                "line-clamp-1 text-slate-500",
                compact ? "text-[10px]" : "text-[11px]",
              )}>
              {[product.subcategoryName, product.categoryName].filter(Boolean).join(' · ')}
            </p>
          )}

          {(product.variantLabel || product.unit) && (
            <p
              className={cn(
                "line-clamp-1 font-semibold text-brand-600",
                compact ? "text-[10px]" : "text-[11px]",
              )}>
              {[product.variantLabel || product.weight, product.unit ? getUnitLabel(product.unit) : null].filter(Boolean).join(' · ')}
            </p>
          )}

          {showStockInfo && product.stockQty != null && product.inStock !== false && (
            <p className={cn("text-slate-500", compact ? "text-[9px]" : "text-[10px]")}>
              {product.stockQty} available
            </p>
          )}

          {/* Price Row / ADD Button */}
          <div className="mt-auto flex items-center justify-between gap-1.5 pt-1">
            <div className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "font-bold text-slate-900",
                  compact ? "text-[13px]" : "text-sm",
                )}>
                {product.hasMultipleVariants && product.displayPrice != null
                  ? product.displayPriceMax > product.displayPrice
                    ? `₹${Number(product.displayPrice).toLocaleString('en-IN')} – ₹${Number(product.displayPriceMax).toLocaleString('en-IN')}`
                    : `From ₹${Number(product.displayPrice).toLocaleString('en-IN')}`
                  : `₹${Number(product.price || 0).toLocaleString('en-IN')}`}
              </span>
              {product.originalPrice > product.price && product.inStock !== false && (
                <span className="text-[10px] font-medium leading-none text-slate-400 line-through">
                  ₹{Number(product.originalPrice).toLocaleString('en-IN')}
                </span>
              )}
            </div>

            {/* ADD Button / Quantity Selector (Always in price row) */}
            <div className="flex">
              {quantity > 0 ? (
                <div
                  className={cn(
                    "flex items-center rounded-lg border-2 border-brand-600 bg-white p-0.5 justify-between",
                    compact ? "min-w-[80px]" : "min-w-[90px] md:min-w-[100px]",
                  )}>
                  <button
                    onClick={handleDecrement}
                    className="p-1 px-1.5 text-brand-600 active:scale-90 transition-transform">
                    {quantity === 1 ? <Trash2 size={compact ? 11 : 13} strokeWidth={2.5} /> : <Minus size={compact ? 12 : 14} strokeWidth={3.5} />}
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                      if (val === '') {
                        updateQuantity(product.id || product._id, 0 - quantity, targetVariantId ? String(targetVariantId) : undefined);
                      } else if (!isNaN(val)) {
                        updateQuantity(product.id || product._id, val - quantity, targetVariantId ? String(targetVariantId) : undefined);
                      }
                    }}
                    className={cn(
                      "w-6 text-center font-bold text-brand-600 bg-transparent border-none outline-none [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none",
                      compact ? "text-[12px]" : "text-[13px] md:text-sm",
                    )}
                  />
                  <button
                    onClick={handleIncrement}
                    className="p-1 px-1.5 text-brand-600 active:scale-90 transition-transform">
                    <Plus size={compact ? 12 : 14} strokeWidth={3.5} />
                  </button>
                </div>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddToCart}
                  disabled={product.inStock === false}
                  className={cn(
                    "rounded-lg border-2 font-bold uppercase tracking-wide leading-none shadow-sm transition-all",
                    product.inStock === false
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                      : "border-[#E23744] bg-[#E23744] text-white hover:bg-[#C41E35] hover:border-[#C41E35] shadow-md shadow-rose-100",
                    compact
                      ? "px-5 py-1.5 text-[12px]"
                      : "px-7 py-2 text-[13px] md:text-sm md:px-8 md:py-2.5",
                  )}>
                  {mustPickVariant && product.inStock !== false ? (
                    <span className="flex flex-col items-center leading-tight">
                      <span>ADD</span>
                      <span className={cn("mt-0.5 font-semibold normal-case tracking-normal", compact ? "text-[9px]" : "text-[10px] md:text-[11px]")}>
                        {optionsSubLabel}
                      </span>
                    </span>
                  ) : (
                    "ADD"
                  )}
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  },
);

export default ProductCard;
