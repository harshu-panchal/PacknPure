import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosCart } from '../context/PosCartContext';
import { usePosEngine } from '../context/PosEngineContext';
import { posApi } from '../services/posApi';
import { toast } from 'sonner';
import { 
    Search, ShoppingCart, Trash2, Plus, Minus, ShoppingBag, ScanLine, ChevronUp, X
} from 'lucide-react';
import { Button, TextField, CircularProgress } from '@mui/material';
import { PaymentModal } from '../components/PaymentModal';
import { CameraScanner } from '../components/CameraScanner';
import { cn } from '@/lib/utils';

export default function PosCheckout() {
    const navigate = useNavigate();
    const { role } = usePosEngine();
    const { 
        cart, cartTotals, addToCart, updateQuantity, setExactQuantity, updateItemPrice, removeItem, clearCart, isCalculating,
        guestCustomer, setGuestCustomer, manualDiscount, setManualDiscount
    } = usePosCart();

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [mobileCartOpen, setMobileCartOpen] = useState(false);
    
    const [currentSession, setCurrentSession] = useState(null);
    const [sessionLoading, setSessionLoading] = useState(true);

    const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [showDiscount, setShowDiscount] = useState(false);
    const [discountInput, setDiscountInput] = useState(manualDiscount.amount || '');
    const [discountReason, setDiscountReason] = useState(manualDiscount.reason || '');

    const [posSettings, setPosSettings] = useState({});

    const searchDebounceRef = useRef(null);

    useEffect(() => {
        if (!mobileCartOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setMobileCartOpen(false);
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [mobileCartOpen]);

    // Fetch Active Session on Load
    useEffect(() => {
        const fetchSession = async () => {
            try {
                const res = await posApi.getCurrentSession();
                if (res.data?.success && res.data?.result) {
                    setCurrentSession(res.data.result);
                } else {
                    toast.error("No active POS session. Please open a session first.");
                    navigate(`/${role}/pos/sessions`);
                }
            } catch (error) {
                toast.error("Error fetching active session.");
                navigate(`/${role}/pos/sessions`);
            } finally {
                setSessionLoading(false);
            }
        };
        fetchSession();

        try {
            const savedSettings = localStorage.getItem('posSettings');
            if (savedSettings) setPosSettings(JSON.parse(savedSettings));
        } catch (e) {}
    }, [navigate, role]);

    const handleApplyDiscount = () => {
        const percent = Number(discountInput);
        if (isNaN(percent) || percent < 0) {
            toast.error("Invalid discount percentage");
            return;
        }
        
        const limitPercent = posSettings.discountLimit ?? 15;
        
        if (percent > limitPercent) {
            toast.error(`Maximum allowed discount is ${limitPercent}%`);
            return;
        }

        const calculatedAmount = (cartTotals.subtotal * percent) / 100;

        setManualDiscount({ amount: calculatedAmount, reason: discountReason });
        setShowDiscount(false);
        toast.success("Discount applied");
    };

    const handleRemoveDiscount = () => {
        setManualDiscount({ amount: 0, reason: '' });
        setDiscountInput('');
        setDiscountReason('');
        setShowDiscount(false);
    };

    const handleSearch = useCallback(async (query) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const res = await posApi.searchProducts({ search: query, limit: 12 });
            if (res.data?.success) {
                setSearchResults(res.data.results || res.data.data || []);
            }
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const onSearchChange = (e) => {
        const val = e.target.value;
        setSearchTerm(val);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            handleSearch(val);
        }, 500);
    };

    const handleCustomerPhoneBlur = async () => {
        if (guestCustomer.phone?.length === 10) {
            try {
                const res = await posApi.searchCustomer(guestCustomer.phone);
                if (res.data?.success && res.data?.result?.customer) {
                    setGuestCustomer(prev => ({ ...prev, name: res.data.result.customer.name }));
                    toast.success("Customer found!");
                }
            } catch (error) {
                // Customer not found, it's fine, treat as new guest
            }
        }
    };

    const handleCheckoutSubmit = async (paymentDetails) => {
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }
        
        setIsProcessing(true);
        try {
            const idempotencyKey = `pos_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            const payload = {
                items: cart.map(item => ({
                    product: item.product,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    name: item.name,
                    price: item.price
                })),
                payment: paymentDetails,
                guestCustomer: guestCustomer.phone ? guestCustomer : undefined,
                posDetails: {
                    posSessionId: currentSession?._id,
                    posTerminalId: currentSession?.terminalId
                },
                discountDetails: manualDiscount,
                fulfillmentDetails: { type: 'TAKE_AWAY' }
            };

            const res = await posApi.processCheckout(payload, idempotencyKey);
            if (res.data?.success) {
                toast.success("Order successful!");
                const orderData = res.data.order;
                clearCart();
                setCheckoutModalOpen(false);
                setMobileCartOpen(false);
                navigate(`/${role}/pos/receipt/${orderData.orderId}`, { state: { orderData } });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Checkout failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddToCart = (product, variant, stock) => {
        addToCart(product, variant, stock);
        if (window.matchMedia('(max-width: 1023px)').matches) {
            setMobileCartOpen(true);
        }
    };

    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const renderCartPanel = (showMobileClose = false) => (
        <>
            <div className="p-3 sm:p-4 bg-gray-800 text-white flex justify-between items-center gap-2 flex-shrink-0">
                <h2 className="font-bold flex items-center text-base sm:text-lg min-w-0">
                    <ShoppingCart className="w-5 h-5 mr-2 flex-shrink-0" aria-hidden />
                    <span className="truncate">Current Order</span>
                    {cartCount > 0 && (
                        <span className="ml-2 bg-primary px-2 py-0.5 rounded-full text-xs font-bold">{cartCount}</span>
                    )}
                </h2>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="bg-gray-700 px-2 py-1 rounded text-xs font-medium max-w-[120px] truncate">
                        {currentSession.terminalId?.name || (typeof currentSession.terminalId === 'string' ? currentSession.terminalId.slice(-4) : 'UNK')}
                    </span>
                    {showMobileClose && (
                        <button
                            type="button"
                            onClick={() => setMobileCartOpen(false)}
                            aria-label="Close cart"
                            className="touch-target inline-flex items-center justify-center rounded-lg hover:bg-gray-700 lg:hidden"
                        >
                            <X className="w-5 h-5" aria-hidden />
                        </button>
                    )}
                </div>
            </div>

            <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-2 flex-shrink-0">
                <div className="flex-1 min-w-0">
                    <TextField 
                        size="small" 
                        fullWidth 
                        placeholder="Customer Phone" 
                        label="Customer Phone"
                        value={guestCustomer.phone}
                        onChange={(e) => setGuestCustomer({...guestCustomer, phone: e.target.value})}
                        onBlur={handleCustomerPhoneBlur}
                        inputProps={{ inputMode: 'numeric' }}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <TextField 
                        size="small" 
                        fullWidth 
                        placeholder="Name (Optional)"
                        label="Customer Name"
                        value={guestCustomer.name}
                        onChange={(e) => setGuestCustomer({...guestCustomer, name: e.target.value})}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3 min-h-0">
                {cart.map((item, index) => (
                    <div key={index} className="flex gap-3 bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-gray-800 line-clamp-2">{item.name}</h4>
                            {item.variantName && item.variantName !== item.name && <p className="text-xs text-gray-500">{item.variantName}</p>}
                            {item.productData?.description && <p className="text-xs text-gray-400 line-clamp-1 mt-1">{item.productData.description}</p>}
                            <div className="mt-2 flex items-center">
                                <span className="text-gray-500 font-bold mr-1">₹</span>
                                <input 
                                    type="number" 
                                    aria-label={`Price for ${item.name}`}
                                    className="w-20 min-h-10 border-b-2 border-blue-200 focus:border-blue-500 bg-blue-50 p-1 text-sm font-bold text-blue-700 focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none rounded"
                                    value={item.price}
                                    onChange={(e) => updateItemPrice(index, e.target.value)}
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col items-end justify-between flex-shrink-0">
                            <button type="button" onClick={() => removeItem(index)} aria-label={`Remove ${item.name}`} className="touch-target inline-flex items-center justify-center text-red-400 hover:text-red-600">
                                <Trash2 className="w-4 h-4" aria-hidden />
                            </button>
                            <div className="flex items-center bg-gray-100 rounded-md border border-gray-200">
                                <button type="button" onClick={() => updateQuantity(index, -1)} aria-label="Decrease quantity" className="touch-target inline-flex items-center justify-center hover:bg-gray-200 rounded-l-md"><Minus className="w-4 h-4" aria-hidden /></button>
                                <input 
                                    type="number" 
                                    aria-label={`Quantity for ${item.name}`}
                                    className="w-12 min-h-10 text-center text-sm font-semibold border-none bg-transparent focus:ring-0 p-0 m-0 [&::-webkit-inner-spin-button]:appearance-none" 
                                    value={item.quantity}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val)) {
                                            setExactQuantity(index, val, item.maxQty);
                                        } else if (e.target.value === '') {
                                            setExactQuantity(index, 0, item.maxQty);
                                        }
                                    }}
                                    min="0"
                                    max={item.maxQty}
                                />
                                <button type="button" onClick={() => updateQuantity(index, 1, item.maxQty)} aria-label="Increase quantity" className="touch-target inline-flex items-center justify-center hover:bg-gray-200 rounded-r-md"><Plus className="w-4 h-4" aria-hidden /></button>
                            </div>
                        </div>
                    </div>
                ))}
                {cart.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center text-gray-400 space-y-2">
                        <ShoppingCart className="w-12 h-12 opacity-20" aria-hidden />
                        <p>Cart is empty</p>
                    </div>
                )}
            </div>

            <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-200 space-y-2 flex-shrink-0 safe-pb">
                <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span>₹{cartTotals.subtotal?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                    <span>GST</span>
                    <span>₹{cartTotals.totalGst?.toFixed(2) || '0.00'}</span>
                </div>
                {cartTotals.discount > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-600 font-medium group">
                        <span>
                            Discount {manualDiscount.reason && `(${manualDiscount.reason})`}
                        </span>
                        <div className="flex items-center gap-2">
                            <span>-₹{cartTotals.discount?.toFixed(2) || '0.00'}</span>
                            <button type="button" onClick={handleRemoveDiscount} className="text-red-400 hover:text-red-600 text-xs min-h-8 px-2">
                                Remove
                            </button>
                        </div>
                    </div>
                )}
                
                {!showDiscount && manualDiscount.amount === 0 && cart.length > 0 && (
                    <button 
                        type="button"
                        onClick={() => setShowDiscount(true)} 
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium text-left min-h-10"
                    >
                        + Add Custom Discount
                    </button>
                )}

                {showDiscount && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 space-y-2 mt-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <TextField 
                                size="small" 
                                placeholder="Percent (%)" 
                                label="Discount %"
                                type="number"
                                value={discountInput}
                                onChange={(e) => setDiscountInput(e.target.value)}
                                className="bg-white flex-1"
                            />
                            <TextField 
                                size="small" 
                                placeholder="Reason" 
                                label="Reason"
                                value={discountReason}
                                onChange={(e) => setDiscountReason(e.target.value)}
                                className="bg-white flex-1"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button size="small" variant="contained" onClick={handleApplyDiscount}>Apply</Button>
                            <Button size="small" onClick={() => setShowDiscount(false)}>Cancel</Button>
                        </div>
                    </div>
                )}

                <div className="flex justify-between text-lg sm:text-xl font-black text-gray-900 pt-2 border-t border-dashed border-gray-300 mt-2">
                    <span>Total Payable</span>
                    <span>
                        {isCalculating ? <CircularProgress size={20} /> : `₹${cartTotals.total?.toFixed(2) || '0.00'}`}
                    </span>
                </div>

                <div className="flex gap-2 pt-2">
                    <Button 
                        variant="outlined" 
                        color="error" 
                        onClick={clearCart}
                        disabled={cart.length === 0}
                        className="!font-bold !rounded-xl !min-h-11"
                    >
                        Clear
                    </Button>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        fullWidth 
                        size="large"
                        className="!font-bold !rounded-xl !text-base sm:!text-lg !py-3 !min-h-11"
                        disabled={cart.length === 0 || isCalculating}
                        onClick={() => setCheckoutModalOpen(true)}
                    >
                        Checkout
                    </Button>
                </div>
            </div>
        </>
    );

    if (sessionLoading) {
        return (
            <div className="flex items-center justify-center min-h-[40vh] text-gray-500" role="status">
                Checking session...
            </div>
        );
    }
    if (!currentSession) return null;

    return (
        <div className="pos-checkout-shell bg-gray-50">
            {/* Product Search & Results */}
            <div className="flex-1 flex flex-col border-r border-gray-200 bg-white min-h-0 min-w-0">
                <div className="p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
                    <div className="flex gap-2">
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" aria-hidden />
                            <input
                                type="search"
                                aria-label="Search products by name, SKU, or barcode"
                                className="w-full min-h-11 pl-10 pr-4 py-2 sm:py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base sm:text-lg"
                                placeholder="Search name, SKU, barcode..."
                                value={searchTerm}
                                onChange={onSearchChange}
                                autoFocus
                            />
                        </div>
                        <Button 
                            variant="outlined" 
                            className="!rounded-xl !min-w-[44px] !min-h-[44px] !px-3 flex-shrink-0"
                            onClick={() => setShowScanner(true)}
                            aria-label="Open barcode scanner"
                        >
                            <ScanLine className="w-6 h-6 text-blue-600" aria-hidden />
                        </Button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 bg-gray-50 min-h-0 pb-24 lg:pb-4">
                    {isSearching ? (
                        <div className="flex justify-center py-10" role="status"><CircularProgress /></div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                            {searchResults.map((product, idx) => {
                                const stock = product.availableQty || 0;
                                const isOutOfStock = stock <= 0;
                                return (
                                    <button
                                        type="button"
                                        key={idx} 
                                        disabled={isOutOfStock}
                                        onClick={() => !isOutOfStock && handleAddToCart(product, product, stock)}
                                        className={`text-left bg-white rounded-xl border p-3 transition-all w-full ${isOutOfStock ? 'opacity-50 border-red-200 cursor-not-allowed' : 'border-gray-200 hover:border-blue-500 hover:shadow-md active:scale-[0.98]'}`}
                                    >
                                        <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                                            {product.image ? (
                                                <img src={product.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                                            ) : (
                                                <ShoppingBag className="w-8 h-8 text-gray-400" aria-hidden />
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-sm line-clamp-2">{product.name} {product.variantName && product.variantName !== product.name && `(${product.variantName})`}</h3>
                                        {product.description && <p className="text-xs text-gray-500 line-clamp-1 mt-1">{product.description}</p>}
                                        <div className="mt-2 flex justify-between items-end gap-2">
                                            <span className="font-black text-blue-600">₹{product.price}</span>
                                            <span className={`text-xs font-medium ${isOutOfStock ? 'text-red-500' : 'text-green-600'}`}>
                                                {stock} in stock
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                            {searchResults.length === 0 && searchTerm && !isSearching && (
                                <div className="col-span-full py-12 text-center text-gray-500">
                                    No products found matching &quot;{searchTerm}&quot;
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile cart trigger */}
            <div className="lg:hidden fixed left-0 right-0 z-shell-topbar px-3 pointer-events-none" style={{ bottom: 'calc(var(--shell-bottom-nav-h) + var(--safe-bottom) + 0.5rem)' }}>
                <button
                    type="button"
                    onClick={() => setMobileCartOpen(true)}
                    className="pointer-events-auto w-full flex items-center justify-between gap-3 bg-gray-900 text-white rounded-xl px-4 py-3 shadow-xl min-h-12"
                    aria-expanded={mobileCartOpen}
                    aria-label={`View cart, ${cartCount} items, total ₹${cartTotals.total?.toFixed(2) || '0.00'}`}
                >
                    <span className="flex items-center gap-2 font-bold">
                        <ShoppingCart className="w-5 h-5" aria-hidden />
                        {cartCount} {cartCount === 1 ? 'item' : 'items'}
                    </span>
                    <span className="flex items-center gap-2 font-black">
                        ₹{cartTotals.total?.toFixed(2) || '0.00'}
                        <ChevronUp className="w-5 h-5" aria-hidden />
                    </span>
                </button>
            </div>

            {/* Mobile cart backdrop */}
            {mobileCartOpen && (
                <button
                    type="button"
                    aria-label="Close cart overlay"
                    className="app-shell-backdrop lg:hidden"
                    onClick={() => setMobileCartOpen(false)}
                />
            )}

            {/* Cart panel — mobile sheet / desktop sidebar */}
            <div
                className={cn(
                    'flex flex-col bg-white shadow-xl z-shell-drawer',
                    'fixed inset-x-0 bottom-0 max-h-[min(88dvh,88vh)] rounded-t-2xl transition-transform duration-300 ease-out lg:static lg:max-h-none lg:rounded-none lg:w-[min(400px,38vw)] lg:max-w-md lg:flex-shrink-0 lg:border-l lg:translate-y-0',
                    mobileCartOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0',
                    !mobileCartOpen && 'pointer-events-none lg:pointer-events-auto invisible lg:visible',
                )}
                role="region"
                aria-label="Order cart"
            >
                {renderCartPanel(true)}
            </div>

            <PaymentModal 
                open={checkoutModalOpen} 
                onOpenChange={setCheckoutModalOpen} 
                total={cartTotals.total || 0} 
                onProcessPayment={handleCheckoutSubmit} 
                isProcessing={isProcessing} 
            />

            {showScanner && (
                <CameraScanner 
                    onClose={() => setShowScanner(false)}
                    onScan={(code) => {
                        setSearchTerm(code);
                        setShowScanner(false);
                        handleSearch(code);
                    }}
                />
            )}
        </div>
    );
}
