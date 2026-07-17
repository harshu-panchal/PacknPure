import React, { createContext, useContext, useState, useEffect } from 'react';
import { posApi } from '../services/posApi';

const PosCartContext = createContext();

export const PosCartProvider = ({ children }) => {
    const [cart, setCart] = useState(() => {
        try {
            const saved = localStorage.getItem('posCart');
            return saved && saved !== 'undefined' ? JSON.parse(saved) : [];
        } catch(e) { return []; }
    });
    const [guestCustomer, setGuestCustomer] = useState(() => {
        try {
            const saved = localStorage.getItem('posGuestCustomer');
            return saved && saved !== 'undefined' ? JSON.parse(saved) : { name: '', phone: '' };
        } catch(e) { return { name: '', phone: '' }; }
    });
    const [manualDiscount, setManualDiscount] = useState(() => {
        try {
            const saved = localStorage.getItem('posManualDiscount');
            return saved && saved !== 'undefined' ? JSON.parse(saved) : { amount: 0, reason: '' };
        } catch(e) { return { amount: 0, reason: '' }; }
    });
    const [fulfillmentType, setFulfillmentType] = useState(() => {
        return localStorage.getItem('posFulfillmentType') || 'TAKE_AWAY';
    });
    const [deliveryAddress, setDeliveryAddress] = useState(() => {
        try {
            const saved = localStorage.getItem('posDeliveryAddress');
            return saved && saved !== 'undefined' ? JSON.parse(saved) : null;
        } catch(e) { return null; }
    });

    useEffect(() => {
        localStorage.setItem('posCart', JSON.stringify(cart));
        localStorage.setItem('posGuestCustomer', JSON.stringify(guestCustomer));
        localStorage.setItem('posManualDiscount', JSON.stringify(manualDiscount));
        localStorage.setItem('posFulfillmentType', fulfillmentType);
        localStorage.setItem('posDeliveryAddress', JSON.stringify(deliveryAddress));
    }, [cart, guestCustomer, manualDiscount, fulfillmentType, deliveryAddress]);
    
    // Add item to cart
    const addToCart = (product, variant = null, maxQty = Infinity) => {
        setCart(prev => {
            // Because variant might be passed as a flattened product object (where _id is master ID, but variantId is the actual variant),
            // or as a separate variant object, we resolve the target variant ID here.
            const targetVariantId = variant && variant._id && variant._id !== product._id 
                ? variant._id 
                : (product.variantId || null);

            const existingIndex = prev.findIndex(item => 
                item.product === product._id && 
                item.variantId === targetVariantId
            );

            if (existingIndex >= 0) {
                const newCart = [...prev];
                const item = { ...newCart[existingIndex] };
                if (item.quantity < maxQty) {
                    item.quantity += 1;
                }
                newCart[existingIndex] = item;
                return newCart;
            }

            return [...prev, {
                product: product._id, // Keep as string for API payloads if needed
                productData: product, // Store the full product object from search results
                name: product.name,
                image: product.images?.[0]?.url || product.image,
                variantId: targetVariantId,
                variantName: variant?.name || product.variantName || null,
                price: variant?.price || product.price || product.basePrice || 0, // Use resolved price
                purchasePrice: variant?.purchasePrice || product.purchasePrice || 0,
                gstEnabled: product.gstEnabled || false,
                gstRate: product.gstRate || 0,
                quantity: 1,
                maxQty,
            }];
        });
    };

    const updateQuantity = (index, delta, maxQty = Infinity) => {
        setCart(prev => {
            const newCart = [...prev];
            const item = { ...newCart[index] };
            const newQty = item.quantity + delta;
            if (newQty > 0 && newQty <= maxQty) {
                item.quantity = newQty;
                newCart[index] = item;
            } else if (newQty <= 0) {
                newCart.splice(index, 1);
            }
            return newCart;
        });
    };

    const setExactQuantity = (index, qty, maxQty = Infinity) => {
        setCart(prev => {
            const newCart = [...prev];
            const item = { ...newCart[index] };
            if (qty >= 0 && qty <= maxQty) { // Allow 0 so user can clear input before typing
                item.quantity = qty;
                newCart[index] = item;
            } else if (qty > maxQty) {
                item.quantity = maxQty; // Cap at max
                newCart[index] = item;
            }
            return newCart;
        });
    };

    const removeItem = (index) => {
        setCart(prev => {
            const newCart = [...prev];
            newCart.splice(index, 1);
            return newCart;
        });
    };

    const clearCart = () => {
        setCart([]);
        setGuestCustomer({ name: '', phone: '' });
        setManualDiscount({ amount: 0, reason: '' });
        setFulfillmentType('TAKE_AWAY');
        setDeliveryAddress(null);
    };

    const [cartTotals, setCartTotals] = useState({ subtotal: 0, totalGst: 0, discount: 0, total: 0 });
    const [isCalculating, setIsCalculating] = useState(false);

    useEffect(() => {
        const calculateTotals = async () => {
            if (cart.length === 0) {
                setCartTotals({ subtotal: 0, totalGst: 0, discount: manualDiscount.amount || 0, total: 0 });
                return;
            }
            setIsCalculating(true);
            try {
                const payload = {
                    items: cart.map(item => ({ 
                        product: item.product, 
                        variantId: item.variantId, 
                        quantity: item.quantity 
                    })),
                    manualDiscount
                };
                const res = await posApi.calculateCartTotals(payload);
                if (res.data?.success) {
                    setCartTotals(res.data.result);
                }
            } catch (error) {
                console.error("Failed to calculate totals from backend:", error);
            } finally {
                setIsCalculating(false);
            }
        };

        const timeoutId = setTimeout(calculateTotals, 300);
        return () => clearTimeout(timeoutId);
    }, [cart, manualDiscount]);

    return (
        <PosCartContext.Provider value={{
            cart,
            guestCustomer,
            manualDiscount,
            fulfillmentType,
            deliveryAddress,
            setGuestCustomer,
            setManualDiscount,
            setFulfillmentType,
            setDeliveryAddress,
            addToCart,
            updateQuantity,
            setExactQuantity,
            removeItem,
            clearCart: () => {
                setCart([]);
                setGuestCustomer({ name: '', phone: '' });
                setManualDiscount({ amount: 0, reason: '' });
                setFulfillmentType('TAKE_AWAY');
                setDeliveryAddress(null);
                localStorage.removeItem('posCart');
                localStorage.removeItem('posGuestCustomer');
                localStorage.removeItem('posManualDiscount');
                localStorage.removeItem('posFulfillmentType');
                localStorage.removeItem('posDeliveryAddress');
            },
            cartTotals,
            isCalculating
        }}>
            {children}
        </PosCartContext.Provider>
    );
};

export const usePosCart = () => useContext(PosCartContext);
