import React, { createContext, useContext, useState, useEffect } from 'react';
import { posApi } from '../services/posApi';

const PosCartContext = createContext();

export const PosCartProvider = ({ children }) => {
    const [cart, setCart] = useState([]);
    const [guestCustomer, setGuestCustomer] = useState({ name: '', phone: '' });
    const [manualDiscount, setManualDiscount] = useState({ amount: 0, reason: '' });
    const [fulfillmentType, setFulfillmentType] = useState('TAKE_AWAY'); // TAKE_AWAY or HOME_DELIVERY
    const [deliveryAddress, setDeliveryAddress] = useState(null);
    
    // Add item to cart
    const addToCart = (product, variant = null, maxQty = Infinity) => {
        setCart(prev => {
            const existingIndex = prev.findIndex(item => 
                item.product === product._id && 
                (variant ? item.variantId === variant._id : !item.variantId)
            );

            if (existingIndex >= 0) {
                const newCart = [...prev];
                if (newCart[existingIndex].quantity < maxQty) {
                    newCart[existingIndex].quantity += 1;
                }
                return newCart;
            }

            return [...prev, {
                product: product._id, // Keep as string for API payloads if needed
                productData: product, // Store the full product object from search results
                name: product.name,
                image: product.images?.[0]?.url || product.image,
                variantId: variant?._id || product.variantId || null,
                variantName: variant?.name || product.variantName || null,
                price: product.price || variant?.price || product.basePrice || 0,
                purchasePrice: product.purchasePrice || variant?.purchasePrice || 0,
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
            const newQty = newCart[index].quantity + delta;
            if (newQty > 0 && newQty <= maxQty) {
                newCart[index].quantity = newQty;
            } else if (newQty <= 0) {
                newCart.splice(index, 1);
            }
            return newCart;
        });
    };

    const setExactQuantity = (index, qty, maxQty = Infinity) => {
        setCart(prev => {
            const newCart = [...prev];
            if (qty > 0 && qty <= maxQty) {
                newCart[index].quantity = qty;
            } else if (qty <= 0) {
                newCart.splice(index, 1);
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
            clearCart,
            cartTotals,
            isCalculating
        }}>
            {children}
        </PosCartContext.Provider>
    );
};

export const usePosCart = () => useContext(PosCartContext);
