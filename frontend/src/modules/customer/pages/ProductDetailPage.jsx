import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, Plus, Minus, Star, ShieldCheck, Clock, ArrowLeft, ShoppingBag, Loader2, ImageIcon, X, CheckCircle, ChevronRight, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { customerApi } from '../services/customerApi';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { ProductImageGallery } from '../components/shared/ProductDetailSheet';
import { getUnitLabel } from '@shared/constants/productUnits';
import {
  resolveVariantKey,
  getVariantId,
  cartKey,
  getVariantPricing,
  getVariantStock,
  getVariantStockBreakdown,
  isVariantInStock,
  buildVariantCartMap,
  pickDefaultVariant,
  applySelectedVariant,
} from '@shared/utils/variantHelpers';

// Mock product data (In a real app, this would come from an API or central store)
const allProducts = [
    {
        id: 1,
        name: 'Fresh Organic Strawberry',
        category: 'Fruits',
        price: 349,
        originalPrice: 499,
        description: "Experience the burst of sweetness with our hand-picked organic strawberries. These berries are grown without synthetic pesticides, ensuring they are as natural as nature intended. Perfect for snacking, desserts, or adding a healthy touch to your breakfast.",
        images: [
            'https://images.unsplash.com/photo-1464960726335-6c7178ed40ad?q=80&w=600&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1518635017498-87f514b751ba?q=80&w=600&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1543528176-61b239510d11?q=80&w=600&auto=format&fit=crop'
        ],
        details: [
            { label: 'Shelf Life', value: '3-4 Days' },
            { label: 'Storage', value: 'Refrigerate' },
            { label: 'Weight', value: '500g' }
        ]
    },
    {
        id: 2,
        name: 'Green Bell Pepper',
        category: 'Vegetables',
        price: 45,
        originalPrice: 60,
        description: "Crispy and fresh green bell peppers, perfect for stir-fries, salads, and stuffing. These peppers are rich in Vitamin C and add a vibrant crunch to any dish.",
        images: [
            'https://images.unsplash.com/photo-1563636619-e9143da7973b?q=80&w=600&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1526346695784-f18aa35730a8?q=80&w=600&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?q=80&w=600&auto=format&fit=crop'
        ],
        details: [
            { label: 'Shelf Life', value: '7 Days' },
            { label: 'Storage', value: 'Cool & Dry Place' },
            { label: 'Weight', value: '250g' }
        ]
    }
];

function formatInr(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function VariantPicker({ variants, selectedKey, onSelect, variantCartMap }) {
  const multi = variants.length > 1;

  return (
    <div className="flex flex-col max-w-full xl:inline-flex">
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
          const { admin: hubStock, seller: sellerStock, hasSplit } = getVariantStockBreakdown(v);
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

              {hasSplit ? (
                <div className="mt-1 space-y-0.5">
                  <p className="text-[10px] font-semibold text-emerald-700">
                    Hub: {hubStock}
                  </p>
                  <p className="text-[10px] font-semibold text-sky-700">
                    Seller: {sellerStock}
                  </p>
                </div>
              ) : (
                <p
                  className={cn(
                    'mt-1 text-[10px] font-semibold',
                    inStock ? 'text-emerald-700' : 'text-slate-400',
                  )}
                >
                  {inStock ? `${stock} in stock` : 'Out of stock'}
                </p>
              )}

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

const RatingSummaryCard = ({ effectiveProduct, className }) => {
    const distObj = effectiveProduct?.ratingDistribution || {};
    const maxCount = Math.max(1, ...[1,2,3,4,5].map(s => Number(distObj[String(s)] || 0)));

    return (
        <div className={cn("bg-white p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between", className)}>
            <div>
                <h3 className="text-xl lg:text-2xl font-black text-slate-800 mb-1">Customer Ratings</h3>
                <div className="flex items-end gap-3 mb-4 lg:mb-6">
                    <span className="text-5xl lg:text-6xl font-black text-slate-800">
                        {Number(effectiveProduct?.averageRating || 0).toFixed(1)}
                    </span>
                    <div className="pb-1 lg:pb-2">
                        <div className="flex gap-0.5 mb-1">
                            {[1,2,3,4,5].map(s => (
                                <Star key={s} size={16} strokeWidth={1.5} className={s <= Math.round(effectiveProduct?.averageRating || 0) ? "fill-[#E23744] text-black" : "fill-transparent text-black"} />
                            ))}
                        </div>
                        <p className="text-xs lg:text-sm font-bold text-slate-400">{effectiveProduct?.totalReviews || 0} reviews</p>
                    </div>
                </div>
            </div>
            {/* Distribution Bars */}
            <div className="flex flex-col gap-1.5 lg:gap-2">
                {[5,4,3,2,1].map(star => {
                    const count = Number(distObj[String(star)] || 0);
                    const pct = Math.round((count / maxCount) * 100);
                    return (
                        <div key={star} className="flex items-center gap-2 lg:gap-3">
                            <span className="text-[10px] lg:text-xs font-black text-slate-500 w-4 lg:w-6 text-right">{star}</span>
                            <Star size={10} strokeWidth={1.5} className="fill-[#E23744] text-black shrink-0" />
                            <div className="flex-1 h-1.5 lg:h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[#E23744] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] lg:text-xs font-bold text-slate-400 w-6 lg:w-8 text-right">{count}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ProductDetailPage = () => {
    const { id } = useParams();
    const location = useLocation();
    const { hash, search, pathname } = location;
    const navigate = useNavigate();
    const { currentLocation } = useAppLocation();
    const { cart, cartCount, addToCart, updateQuantity, removeFromCart } = useCart();
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
    const { showToast } = useToast();

    const [product, setProduct] = useState(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [reviews, setReviews] = useState([]);
    const [reviewsTotal, setReviewsTotal] = useState(0);
    const [reviewPage, setReviewPage] = useState(1);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [hasReviewed, setHasReviewed] = useState(false);
    const [selectedReviewImage, setSelectedReviewImage] = useState(null);
    const [newReview, setNewReview] = useState({ rating: 5, title: '', comment: '' });
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [selectedVariantKey, setSelectedVariantKey] = useState(null);

    const reviewsRef = useRef(null);

    const images = useMemo(() => {
        if (!product) return [];
        const out = [];
        if (product.mainImage) out.push(product.mainImage);
        else if (product.image) out.push(product.image);
        if (Array.isArray(product.galleryImages)) {
            out.push(...product.galleryImages.filter(Boolean));
        }
        return out.length ? out : ['https://images.unsplash.com/photo-1542838132-92c53300491e'];
    }, [product]);

    const variants = useMemo(
        () => (Array.isArray(product?.variants) ? product.variants : []),
        [product?.variants],
    );
    const hasVariants = variants.length > 0;

    useEffect(() => {
        const queryParams = new URLSearchParams(search);
        const variantParam = queryParams.get('variant');

        if (variantParam && variants.length > 0) {
            const v = variants.find(v => getVariantId(v) === variantParam);
            if (v) {
                setSelectedVariantKey(resolveVariantKey(v));
                return;
            }
        }
        const pick = pickDefaultVariant(variants);
        setSelectedVariantKey(pick ? resolveVariantKey(pick) : null);
    }, [product?.id, variants, search]);

    const selectedVariant = useMemo(() => {
        if (!hasVariants) return null;
        if (!selectedVariantKey) return variants[0];
        return variants.find((v) => resolveVariantKey(v) === selectedVariantKey) || variants[0];
    }, [hasVariants, variants, selectedVariantKey]);

    const effectiveProduct = useMemo(() => {
        if (!product) return null;
        if (!selectedVariant) return product;
        return applySelectedVariant(product, selectedVariant);
    }, [product, selectedVariant]);

    const selectedVariantId = selectedVariant ? getVariantId(selectedVariant) : '';

    const productId = effectiveProduct?.id || effectiveProduct?._id;

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
    const [inputValue, setInputValue] = useState(String(quantity));

    useEffect(() => {
        setInputValue(String(quantity));
    }, [quantity]);

    useEffect(() => {
        const val = parseInt(inputValue, 10);
        if (!isNaN(val) && val >= 1 && val !== quantity) {
            const timer = setTimeout(async () => {
                const res = await updateQuantity(productId, val - quantity, selectedVariantId, product);
                if (res === false) {
                    setInputValue(String(quantity));
                }
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [inputValue, quantity, productId, product, updateQuantity, selectedVariantId]);

    useEffect(() => {
        if (productId) {
            const saved = sessionStorage.getItem(`pendingReview_${productId}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setNewReview(prev => ({ ...prev, ...parsed }));
                } catch(e) {}
                sessionStorage.removeItem(`pendingReview_${productId}`);
            }
        }
    }, [productId]);

    const hasValidLocation =
        Number.isFinite(currentLocation?.latitude) &&
        Number.isFinite(currentLocation?.longitude);

    useEffect(() => {
        if (id && hasValidLocation) {
            fetchProduct();
        } else if (id && !hasValidLocation) {
            // Keep loading until location is resolved
            setLoading(true);
        }
    }, [id, hasValidLocation, currentLocation?.latitude, currentLocation?.longitude]);

    useEffect(() => {
        if (productId && (!hasVariants || selectedVariantId)) {
            fetchReviews(1);
            checkIfReviewed();
        }
    }, [productId, selectedVariantId, hasVariants]);

    // Scroll to reviews section if URL has #reviews hash
    useEffect(() => {
        if (hash === '#reviews' && reviewsRef.current && !loading) {
            setTimeout(() => {
                reviewsRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 400);
        }
    }, [hash, loading]);

    const fetchProduct = async () => {
        try {
            setLoading(true);
            const params = {};
            if (currentLocation?.latitude && currentLocation?.longitude) {
                params.lat = currentLocation.latitude;
                params.lng = currentLocation.longitude;
            }
            const res = await customerApi.getProductById(id, params);
            if (res.data.success) {
                const p = res.data.result;
                setProduct(p);
                setActiveImageIndex(0);
            }
        } catch (error) {
            console.error("Fetch product error:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReviews = async (page = 1) => {
        if (!productId) return;
        try {
            setReviewLoading(true);
            const params = { page, limit: 10 };
            if (selectedVariantId) params.variantId = selectedVariantId;
            const res = await customerApi.getProductReviews(productId, params);
            if (res.data.success) {
                const payload = res.data.result;
                const items = Array.isArray(payload.items) ? payload.items : [];
                if (page === 1) {
                    setReviews(items);
                } else {
                    setReviews(prev => [...prev, ...items]);
                }
                setReviewsTotal(payload.total || 0);
                setReviewPage(page);
            }
        } catch (error) {
            console.error("Fetch reviews error:", error);
        } finally {
            setReviewLoading(false);
        }
    };

    const checkIfReviewed = async () => {
        if (!productId) return;
        try {
            const params = selectedVariantId ? { variantId: selectedVariantId } : {};
            const res = await customerApi.checkUserReview(productId, params);
            if (res.data.success) {
                setHasReviewed(res.data.result?.hasReviewed || false);
            }
        } catch {
            // Not logged in or error — treat as not reviewed
        }
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files || []);
        const valid = files.filter(f => f.type.startsWith('image/')).slice(0, 4);
        setImageFiles(valid);
        setImagePreviews(valid.map(f => URL.createObjectURL(f)));
    };

    const removeImage = (idx) => {
        setImageFiles(prev => prev.filter((_, i) => i !== idx));
        setImagePreviews(prev => {
            URL.revokeObjectURL(prev[idx]);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!newReview.comment.trim()) return;
        if (!selectedVariantId) {
            showToast("Please select a pack size before submitting a review.", "error");
            return;
        }
        if (!productId) return;

        try {
            setIsSubmittingReview(true);
            const formData = new FormData();
            formData.append('productId', productId);
            formData.append('variantId', selectedVariantId);
            formData.append('rating', String(newReview.rating));
            formData.append('title', newReview.title.trim());
            formData.append('comment', newReview.comment.trim());
            imageFiles.forEach(file => formData.append('images', file));

            const res = await customerApi.submitReview(formData);
            if (res.data.success) {
                showToast("Review submitted successfully!", "success");
                setNewReview({ rating: 5, title: '', comment: '' });
                setImageFiles([]);
                setImagePreviews([]);
                setHasReviewed(true);
                fetchReviews(1);
                fetchProduct();
            }
        } catch (error) {
            if (error.response?.status === 401 || error.response?.data?.message?.toLowerCase().includes("unauthorized")) {
                sessionStorage.setItem(`pendingReview_${productId}`, JSON.stringify({ 
                    rating: newReview.rating, 
                    title: newReview.title.trim(), 
                    comment: newReview.comment.trim() 
                }));
                showToast("Please login to submit a review", "error");
                navigate('/login', { state: { from: pathname + search + hash } });
                return;
            }
            const msg = error.response?.data?.message || "Failed to submit review";
            showToast(msg, "error");
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleToggleWishlist = () => {
        toggleWishlistGlobal(product);
        showToast(
            isWishlisted ? `${product.name} removed from wishlist` : `${product.name} added to wishlist`,
            isWishlisted ? 'info' : 'success'
        );
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="h-12 w-12 border-4 border-[#E23744] border-t-transparent rounded-full animate-spin"></div>
                <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Loading Product...</p>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <div className="h-24 w-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                    <ShoppingBag size={48} />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black text-slate-800">Product Not Found</h2>
                    <p className="text-slate-500 font-medium tracking-tight">The item you are looking for might have been moved or removed.</p>
                </div>
                <Link to="/products">
                    <Button className="bg-[#E23744] hover:bg-[#C41E35] text-white px-8 h-12 font-black rounded-xl">GO BACK SHOPPING</Button>
                </Link>
            </div>
        );
    }

    const isWishlisted = isInWishlist(product._id || product.id);

    const productDetails = [
        { label: 'Unit', value: getUnitLabel(product.unit || product.masterProductId?.unit || 'Pieces') },
        { label: 'Weight', value: product.weight || product.masterProductId?.weight || 'N/A' },
        { label: 'Brand', value: product.brand || product.masterProductId?.brand || 'Fresh' }
    ];

    return (
        <div className="relative z-10 py-8 w-full max-w-[1920px] mx-auto px-4 md:px-[50px] animate-in fade-in duration-700 pt-6 md:pt-8">
            {/* Back Button */}
            <Link to={-1} className="inline-flex items-center gap-2 text-slate-500 hover:text-[#E23744] font-bold mb-6 transition-colors group">
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Back
            </Link>

            <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">
                {/* Image Gallery Section */}
                <div className="lg:w-[45%] xl:w-[35%] relative">
                    <button
                        onClick={handleToggleWishlist}
                        className={cn(
                            "absolute top-5 right-5 p-3.5 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 z-10",
                            isWishlisted ? "bg-red-50 text-red-500" : "bg-white text-slate-400"
                        )}
                    >
                        <Heart size={20} className={cn(isWishlisted && "fill-current")} />
                    </button>
                    <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                        <ProductImageGallery
                            images={images}
                            name={product.name}
                            activeIndex={activeImageIndex}
                            onSelect={setActiveImageIndex}
                            fullFrame={true}
                        />
                    </div>
                </div>

                {/* Product Info Section */}
                <div className="lg:w-[55%] xl:w-[65%] space-y-6 md:space-y-8">
                    <div className="flex flex-col xl:flex-row gap-12 xl:gap-16 items-start justify-between w-full">
                        <div className="flex-1 space-y-6 md:space-y-8 min-w-0 w-full">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                            <span className="bg-[#E23744]/10 text-[#E23744] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-[#E23744]/20">
                                {effectiveProduct.categoryId?.name || effectiveProduct.category || 'Product'}
                            </span>
                            <button
                                onClick={() => reviewsRef.current?.scrollIntoView({ behavior: 'smooth' })}
                                className="flex items-center gap-1 text-brand-600 font-bold bg-brand-50 px-3 py-0.5 rounded-full text-xs hover:bg-brand-100 transition-colors cursor-pointer"
                            >
                                <Star size={12} fill="currentColor" /> {Number(effectiveProduct.averageRating || 0).toFixed(1)} ({effectiveProduct.totalReviews || 0} Reviews)
                            </button>
                            {effectiveProduct.gstEnabled === true ? (
                                <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-200">
                                    GST Inclusive
                                </span>
                            ) : null}
                        </div>

                        <h1 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight mb-3">
                            {effectiveProduct.name}
                        </h1>

                        <div className="flex items-baseline gap-4 mb-5">
                            <span className="text-4xl font-black text-[#E23744]">₹{effectiveProduct.salePrice || effectiveProduct.price}</span>
                            {effectiveProduct.salePrice > 0 && effectiveProduct.salePrice < effectiveProduct.price && (
                                <>
                                    <span className="text-lg text-slate-400 line-through font-bold">₹{effectiveProduct.price}</span>
                                    <span className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded-lg font-black uppercase">
                                        {Math.round(((effectiveProduct.price - effectiveProduct.salePrice) / effectiveProduct.price) * 100)}% OFF
                                    </span>
                                </>
                            )}
                        </div>

                        {hasVariants && (
                            <div className="mb-6">
                                <VariantPicker
                                    variants={variants}
                                    selectedKey={selectedVariantKey}
                                    onSelect={setSelectedVariantKey}
                                    variantCartMap={variantCartMap}
                                />
                            </div>
                        )}

                        <p className="text-slate-600 text-lg leading-relaxed mb-6 font-medium max-w-2xl">
                            {effectiveProduct.description || effectiveProduct.masterProductId?.description || "No description available for this item."}
                        </p>
                    </div>
                </div>

                {/* Rating Summary Card for Web View */}
                <RatingSummaryCard effectiveProduct={effectiveProduct} className="hidden xl:flex w-[480px] shrink-0 mt-12" />
            </div>

                {/* Order Controls */}
                <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                        {quantity > 0 ? (
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="flex items-center bg-[#E23744] text-white rounded-2xl h-16 w-full sm:w-auto px-2 shadow-xl shadow-rose-100">
                                    <button
                                        onClick={() => {
                                            if (quantity === 1) {
                                                removeFromCart(productId, selectedVariantId);
                                            } else {
                                                updateQuantity(productId, -1, selectedVariantId);
                                            }
                                        }}
                                        className="w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all"
                                    >
                                        {quantity === 1 ? <Trash2 size={22} strokeWidth={2.5} /> : <Minus size={24} strokeWidth={3} />}
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
                                        className="w-16 bg-transparent text-center font-black text-xl border-none outline-none [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none text-white placeholder-white/50"
                                    />
                                    <button
                                        onClick={() => updateQuantity(productId, 1, selectedVariantId, product)}
                                        className="w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all"
                                    >
                                        <Plus size={24} strokeWidth={3} />
                                    </button>
                                </div>
                                <Link
                                    to="/cart"
                                    style={{ backgroundColor: "#E23744" }}
                                    className="flex h-16 w-full sm:w-auto min-w-[180px] items-center gap-3 text-white px-3 pr-4 rounded-2xl shadow-xl shadow-rose-100 hover:scale-[1.02] active:scale-95 transition-all group border border-white/10 relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                                        <div className="absolute inset-y-0 left-[-40%] w-[40%] bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg] animate-[shimmer_2s_infinite]" />
                                    </div>
                                    <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                                        {cart && cart.length > 0 ? (
                                            <img src={cart[0].image || cart[0].mainImage || images[0]} alt="Cart" className="w-full h-full object-contain p-1" />
                                        ) : (
                                            <ShoppingBag size={20} className="text-[#E23744]" />
                                        )}
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center min-w-0 text-left">
                                        <h4 className="text-sm font-black leading-tight uppercase">View cart</h4>
                                        <p className="text-[10px] font-bold opacity-90 leading-tight">{cartCount} {cartCount === 1 ? 'item' : 'items'}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                        <ChevronRight size={20} strokeWidth={3} className="text-white" />
                                    </div>
                                </Link>
                            </div>
                        ) : (
                            <Button
                                onClick={() => {
                                    addToCart({ ...effectiveProduct, selectedVariantId });
                                    showToast(`${effectiveProduct.name} added to cart`, 'success');
                                }}
                                className="h-16 w-full sm:w-64 bg-[#E23744] hover:bg-[#C41E35] text-white text-lg font-black rounded-2xl shadow-xl shadow-rose-100 transition-all hover:-translate-y-1"
                            >
                                <Plus className="mr-2" size={24} strokeWidth={3} /> ADD TO CART
                            </Button>
                        )}

                        <div className="flex flex-col gap-1 text-center sm:text-left">
                            <span className="text-xs font-black text-[#E23744] uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1">
                                <ShieldCheck size={14} /> Hygiene Guaranteed
                            </span>
                            <span className="text-sm font-bold text-slate-400 flex items-center justify-center sm:justify-start gap-1">
                                <Clock size={14} /> Delivered in 10-15 mins
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {productDetails.map((detail, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{detail.label}</p>
                                <p className="text-sm font-black text-slate-800">{detail.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Reviews Section */}
            <div ref={reviewsRef} className="mt-8 md:mt-10 border-t border-slate-100 pt-8 md:pt-10 scroll-mt-28">
                <div className="flex flex-col lg:flex-row gap-12">

                    {/* Left: Rating Summary + Review Form */}
                    <div className="lg:w-[40%] space-y-6">

                        {/* Rating Summary Card for Mobile/Tablet */}
                        <RatingSummaryCard effectiveProduct={effectiveProduct} className="xl:hidden" />

                        {/* Write a Review Form */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                            {hasReviewed ? (
                                <div className="text-center py-6">
                                    <CheckCircle className="text-emerald-500 mx-auto mb-3" size={40} />
                                    <h3 className="text-xl font-black text-slate-800 mb-1">Review Submitted</h3>
                                    <p className="text-slate-500 text-sm font-medium">Thank you for sharing your experience! Your review is now live.</p>
                                </div>
                            ) : (
                                <>
                                    <h3 className="text-2xl font-black text-slate-800 mb-2">Write a Review</h3>
                                    <p className="text-slate-500 font-medium mb-6 text-sm">Share your experience with this product</p>
                                    <form onSubmit={handleReviewSubmit} className="space-y-5">
                                        {/* Star Picker */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Your Rating *</label>
                                            <div className="flex gap-2">
                                                {[1,2,3,4,5].map(star => (
                                                    <button key={star} type="button"
                                                        onClick={() => setNewReview(r => ({ ...r, rating: star }))}
                                                        className={cn("h-11 w-11 rounded-xl flex items-center justify-center transition-all group", newReview.rating >= star ? "bg-[#E23744]/10 text-[#E23744]" : "bg-slate-50")}
                                                    >
                                                        <Star className={cn("h-6 w-6 transition-all", newReview.rating >= star ? "fill-[#E23744] text-black" : "fill-transparent text-black stroke-black")} strokeWidth={1.5} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Title */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Review Title</label>
                                            <input
                                                type="text"
                                                value={newReview.title}
                                                onChange={e => setNewReview(r => ({ ...r, title: e.target.value }))}
                                                placeholder="Sum up your experience in a line"
                                                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none ring-1 ring-transparent focus:ring-[#E23744]/20 transition-all"
                                            />
                                        </div>
                                        {/* Comment */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Comment *</label>
                                            <textarea
                                                value={newReview.comment}
                                                onChange={e => setNewReview(r => ({ ...r, comment: e.target.value }))}
                                                placeholder="What did you like or dislike?"
                                                className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-bold min-h-[120px] outline-none ring-1 ring-transparent focus:ring-[#E23744]/20 transition-all resize-none"
                                                required
                                            />
                                        </div>
                                        {/* Image Upload */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Product Photos (up to 4)</label>
                                            {imagePreviews.length < 4 && (
                                                <label className="flex items-center gap-3 cursor-pointer bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl px-4 py-3 hover:border-[#E23744]/40 hover:bg-[#E23744]/5 transition-all">
                                                    <ImageIcon size={18} className="text-slate-400" />
                                                    <span className="text-sm font-bold text-slate-400">Add photos</span>
                                                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                                                </label>
                                            )}
                                            {imagePreviews.length > 0 && (
                                                <div className="flex gap-2 flex-wrap mt-2">
                                                    {imagePreviews.map((src, i) => (
                                                        <div key={i} className="relative h-16 w-16 rounded-xl overflow-hidden border border-slate-100">
                                                            <img src={src} className="h-full w-full object-cover" alt={`preview ${i+1}`} />
                                                            <button type="button" onClick={() => removeImage(i)}
                                                                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <Button type="submit" disabled={isSubmittingReview || !newReview.comment.trim()}
                                            className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-xl shadow-slate-100 transition-all active:scale-95">
                                            {isSubmittingReview ? (<><Loader2 size={16} className="animate-spin mr-2 inline" />SUBMITTING...</>) : "SUBMIT REVIEW"}
                                        </Button>
                                        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
                                            Your review will be posted publicly
                                        </p>
                                    </form>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right: Reviews List */}
                    <div className="lg:w-[60%] space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-3xl font-black text-slate-800">All Reviews</h3>
                            <span className="text-sm font-bold text-slate-400">{reviewsTotal} total</span>
                        </div>

                        {reviewLoading && reviews.length === 0 ? (
                            <div className="flex justify-center p-20">
                                <Loader2 className="animate-spin text-[#E23744]" size={32} />
                            </div>
                        ) : reviews.length > 0 ? (
                            <>
                                <div className="space-y-5">
                                    {reviews.map(review => (
                                        <div key={review._id} className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-500 text-lg overflow-hidden shrink-0">
                                                        {review.userId?.image
                                                            ? <img src={review.userId.image} className="w-full h-full object-cover" alt="" />
                                                            : (review.userId?.name?.[0] || '?').toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-800 text-sm">{review.userId?.name || 'Anonymous'}</p>
                                                        <div className="flex gap-0.5 mt-0.5">
                                                            {[1,2,3,4,5].map(s => (
                                                                <Star key={s} size={11} strokeWidth={1.5} className={s <= review.rating ? "fill-[#E23744] text-black" : "fill-transparent text-black"} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
                                                    {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                            {review.title && <p className="font-black text-slate-800 text-sm mb-1">{review.title}</p>}
                                            <p className="text-slate-600 font-medium leading-relaxed text-sm">{review.comment}</p>
                                            {review.images?.length > 0 && (
                                                <div className="flex gap-2 mt-4 flex-wrap">
                                                    {review.images.map((img, i) => (
                                                        <img key={i} src={img} alt={`review ${i+1}`}
                                                            onClick={() => setSelectedReviewImage(img)}
                                                            className="h-20 w-20 rounded-xl object-cover border border-slate-100 cursor-pointer hover:scale-105 transition-transform" />
                                                    ))}
                                                </div>
                                            )}
                                            {review.verifiedPurchase && (
                                                <span className="inline-flex items-center gap-1 mt-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                                    <CheckCircle size={11} /> Verified Purchase
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {reviews.length < reviewsTotal && (
                                    <button onClick={() => fetchReviews(reviewPage + 1)}
                                        disabled={reviewLoading}
                                        className="w-full py-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-100 transition-all disabled:opacity-50">
                                        {reviewLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Load More Reviews (${reviewsTotal - reviews.length} remaining)`}
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="p-20 text-center rounded-[3rem] bg-slate-50 border-2 border-dashed border-slate-200">
                                <Star size={40} className="text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-400 font-black uppercase text-sm">No reviews yet.</p>
                                <p className="text-slate-300 font-bold text-xs mt-1">Be the first to review this product!</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { title: 'Organic & Fresh', desc: 'Directly sourced from trusted local organic farms.', icon: '🌱' },
                    { title: 'Superfast Delivery', desc: 'Your groceries at your doorstep in under 10 minutes.', icon: '⚡' },
                    { title: 'Quality Checked', desc: 'Every item goes through 3 layers of quality checks.', icon: '🏆' }
                ].map((benefit, i) => (
                    <div key={i} className="p-8 rounded-[2rem] bg-white border border-slate-100 shadow-sm text-center">
                        <span className="text-4xl mb-4 block">{benefit.icon}</span>
                        <h3 className="text-xl font-black text-slate-800 mb-2">{benefit.title}</h3>
                        <p className="text-slate-500 font-medium">{benefit.desc}</p>
                    </div>
                ))}
            </div>
            {/* Fullscreen Review Image Modal */}
            {selectedReviewImage && (
                <div 
                    className="fixed inset-0 z-[600] flex items-center justify-center bg-black/90 p-4" 
                    onClick={() => setSelectedReviewImage(null)}
                >
                    <button 
                        className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors" 
                        onClick={() => setSelectedReviewImage(null)}
                    >
                        <X size={32} />
                    </button>
                    <img 
                        src={selectedReviewImage} 
                        className="max-w-full max-h-[90vh] object-contain rounded-lg" 
                        alt="Review fullscreen" 
                        onClick={e => e.stopPropagation()} 
                    />
                </div>
            )}
        </div>
    );
};

export default ProductDetailPage;
