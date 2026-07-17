import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosCart } from '../context/PosCartContext';
import { posApi } from '../services/posApi';
import { toast } from 'sonner';
import { 
    Search, ShoppingCart, Trash2, Plus, Minus, User, 
    CreditCard, Banknote, Smartphone, CheckCircle, AlertCircle, ShoppingBag, ScanLine
} from 'lucide-react';
import { Button, TextField, CircularProgress } from '@mui/material';
import { PaymentModal } from '../components/PaymentModal';
import { CameraScanner } from '../components/CameraScanner';

export default function PosCheckout() {
    const navigate = useNavigate();
    const { 
        cart, cartTotals, addToCart, updateQuantity, setExactQuantity, removeItem, clearCart, isCalculating,
        guestCustomer, setGuestCustomer, manualDiscount, setManualDiscount
    } = usePosCart();

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    
    const [currentSession, setCurrentSession] = useState(null);
    const [sessionLoading, setSessionLoading] = useState(true);

    const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash'); // cash, upi, card
    const [amountGiven, setAmountGiven] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [showDiscount, setShowDiscount] = useState(false);
    const [discountInput, setDiscountInput] = useState(manualDiscount.amount || '');
    const [discountReason, setDiscountReason] = useState(manualDiscount.reason || '');

    const [posSettings, setPosSettings] = useState({});

    const searchDebounceRef = useRef(null);

    // Fetch Active Session on Load
    useEffect(() => {
        const fetchSession = async () => {
            try {
                const res = await posApi.getCurrentSession();
                if (res.data?.success && res.data?.result) {
                    setCurrentSession(res.data.result);
                } else {
                    toast.error("No active POS session. Please open a session first.");
                    navigate('/admin/pos/sessions');
                }
            } catch (error) {
                toast.error("Error fetching active session.");
                navigate('/admin/pos/sessions');
            } finally {
                setSessionLoading(false);
            }
        };
        fetchSession();

        try {
            const savedSettings = localStorage.getItem('posSettings');
            if (savedSettings) setPosSettings(JSON.parse(savedSettings));
        } catch (e) {}
    }, [navigate]);

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

    // Product Search Logic
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

    // Customer Phone Search
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

    // Checkout Logic
    const handleCheckoutSubmit = async (paymentDetails) => {
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }
        
        setIsProcessing(true);
        try {
            // Generate idempotency key
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
                fulfillmentDetails: { type: 'TAKE_AWAY' } // Standard POS walk-in
            };

            const res = await posApi.processCheckout(payload, idempotencyKey);
            if (res.data?.success) {
                toast.success("Order successful!");
                const orderData = res.data.order;
                clearCart();
                setCheckoutModalOpen(false);
                // Navigate to Receipt Page with state
                navigate(`/admin/pos/receipt/${orderData.orderId}`, { state: { orderData } });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Checkout failed");
        } finally {
            setIsProcessing(false);
        }
    };

    if (sessionLoading) return <div className="p-8 text-center text-gray-500">Checking session...</div>;
    if (!currentSession) return null;

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">
            {/* Left: Product Search & Results */}
            <div className="flex-1 flex flex-col border-r border-gray-200 bg-white">
                <div className="p-4 border-b border-gray-200">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                                placeholder="Search by Name, SKU, or scan Barcode..."
                                value={searchTerm}
                                onChange={onSearchChange}
                                autoFocus
                            />
                        </div>
                        <Button 
                            variant="outlined" 
                            className="!rounded-xl !px-4"
                            onClick={() => setShowScanner(true)}
                        >
                            <ScanLine className="w-6 h-6 text-blue-600" />
                        </Button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    {isSearching ? (
                        <div className="flex justify-center py-10"><CircularProgress /></div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {searchResults.map((product, idx) => {
                                const stock = product.availableQty || 0;
                                const isOutOfStock = stock <= 0;
                                return (
                                    <div 
                                        key={idx} 
                                        onClick={() => !isOutOfStock && addToCart(product, product, stock)}
                                        className={`bg-white rounded-xl border p-3 cursor-pointer transition-all ${isOutOfStock ? 'opacity-50 border-red-200' : 'border-gray-200 hover:border-blue-500 hover:shadow-md'}`}
                                    >
                                        <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                                            {product.image ? (
                                                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <ShoppingBag className="w-8 h-8 text-gray-400" />
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-sm line-clamp-2">{product.name} {product.variantName && product.variantName !== product.name && `(${product.variantName})`}</h3>
                                        {product.description && <p className="text-xs text-gray-500 line-clamp-1 mt-1">{product.description}</p>}
                                        <div className="mt-2 flex justify-between items-end">
                                            <span className="font-black text-blue-600">₹{product.price}</span>
                                            <span className={`text-xs font-medium ${isOutOfStock ? 'text-red-500' : 'text-green-600'}`}>
                                                {stock} in stock
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            {searchResults.length === 0 && searchTerm && !isSearching && (
                                <div className="col-span-full py-12 text-center text-gray-500">
                                    No products found matching "{searchTerm}"
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Cart & Checkout */}
            <div className="w-[400px] flex flex-col bg-white shadow-xl z-10">
                <div className="p-4 bg-gray-800 text-white flex justify-between items-center">
                    <h2 className="font-bold flex items-center text-lg">
                        <ShoppingCart className="w-5 h-5 mr-2" /> Current Order
                    </h2>
                    <span className="bg-gray-700 px-2 py-1 rounded text-xs font-medium">
                        Terminal: {currentSession.terminalId?.name || (typeof currentSession.terminalId === 'string' ? currentSession.terminalId.slice(-4) : 'UNK')}
                    </span>
                </div>

                {/* Customer Details */}
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-2">
                    <div className="flex-1">
                        <TextField 
                            size="small" 
                            fullWidth 
                            placeholder="Customer Phone" 
                            value={guestCustomer.phone}
                            onChange={(e) => setGuestCustomer({...guestCustomer, phone: e.target.value})}
                            onBlur={handleCustomerPhoneBlur}
                        />
                    </div>
                    <div className="flex-1">
                        <TextField 
                            size="small" 
                            fullWidth 
                            placeholder="Name (Optional)"
                            value={guestCustomer.name}
                            onChange={(e) => setGuestCustomer({...guestCustomer, name: e.target.value})}
                        />
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.map((item, index) => (
                        <div key={index} className="flex gap-3 bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                            <div className="flex-1">
                                <h4 className="font-semibold text-sm text-gray-800 line-clamp-2">{item.name}</h4>
                                {item.variantName && item.variantName !== item.name && <p className="text-xs text-gray-500">{item.variantName}</p>}
                                {item.productData?.description && <p className="text-xs text-gray-400 line-clamp-1 mt-1">{item.productData.description}</p>}
                                <div className="font-bold text-blue-600 mt-1">₹{item.price}</div>
                            </div>
                            <div className="flex flex-col items-end justify-between">
                                <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 p-1">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="flex items-center bg-gray-100 rounded-md border border-gray-200">
                                    <button onClick={() => updateQuantity(index, -1)} className="p-1 hover:bg-gray-200 rounded-l-md"><Minus className="w-4 h-4" /></button>
                                    <input 
                                        type="number" 
                                        className="w-12 text-center text-sm font-semibold border-none bg-transparent focus:ring-0 p-0 m-0 [&::-webkit-inner-spin-button]:appearance-none" 
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
                                    <button onClick={() => updateQuantity(index, 1, item.maxQty)} className="p-1 hover:bg-gray-200 rounded-r-md"><Plus className="w-4 h-4" /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                            <ShoppingCart className="w-12 h-12 opacity-20" />
                            <p>Cart is empty</p>
                        </div>
                    )}
                </div>

                {/* Cart Totals & Checkout Button */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-2">
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
                                <button onClick={handleRemoveDiscount} className="text-red-400 hover:text-red-600 text-xs hidden group-hover:block">
                                    Remove
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {!showDiscount && manualDiscount.amount === 0 && cart.length > 0 && (
                        <button 
                            onClick={() => setShowDiscount(true)} 
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium text-left"
                        >
                            + Add Custom Discount
                        </button>
                    )}

                    {showDiscount && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 space-y-2 mt-2">
                            <div className="flex gap-2">
                                <TextField 
                                    size="small" 
                                    placeholder="Percent (%)" 
                                    type="number"
                                    value={discountInput}
                                    onChange={(e) => setDiscountInput(e.target.value)}
                                    className="bg-white"
                                />
                                <TextField 
                                    size="small" 
                                    placeholder="Reason" 
                                    value={discountReason}
                                    onChange={(e) => setDiscountReason(e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button size="small" variant="contained" onClick={handleApplyDiscount}>Apply</Button>
                                <Button size="small" onClick={() => setShowDiscount(false)}>Cancel</Button>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between text-xl font-black text-gray-900 pt-2 border-t border-dashed border-gray-300 mt-2">
                        <span>Total Payable</span>
                        <span>
                            {isCalculating ? <CircularProgress size={20} /> : `₹${cartTotals.total?.toFixed(2) || '0.00'}`}
                        </span>
                    </div>

                    <div className="flex gap-2 pt-4">
                        <Button 
                            variant="outlined" 
                            color="error" 
                            onClick={clearCart}
                            disabled={cart.length === 0}
                            className="!font-bold !rounded-xl"
                        >
                            Clear
                        </Button>
                        <Button 
                            variant="contained" 
                            color="primary" 
                            fullWidth 
                            size="large"
                            className="!font-bold !rounded-xl !text-lg !py-3"
                            disabled={cart.length === 0 || isCalculating}
                            onClick={() => setCheckoutModalOpen(true)}
                        >
                            Checkout
                        </Button>
                    </div>
                </div>
            </div>

            {/* Checkout Modal */}
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