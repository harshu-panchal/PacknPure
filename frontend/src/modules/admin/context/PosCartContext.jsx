import React, { createContext, useContext, useState, useMemo } from 'react';

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
                product: product._id,
                name: product.name,
                image: product.images?.[0]?.url || product.image,
                variantId: variant?._id || null,
                variantName: variant?.name || null,
                price: variant?.price || product.basePrice || 0,
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

    // Calculations
    const cartTotals = useMemo(() => {
        let subtotal = 0;
        let totalGst = 0;

        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;
            
            // Reversing GST if it's inclusive (based on the system's logic, usually customer price is inclusive of GST)
            if (item.gstEnabled && item.gstRate) {
                // If price is inclusive of GST: Base = Price / (1 + Rate/100)
                // For this platform, pricing calculation in backend treats final price as inclusive.
                // We'll just show approximate breakdown. The backend validates it exactly.
                const base = itemTotal / (1 + (item.gstRate / 100));
                totalGst += (itemTotal - base);
            }
        });

        const total = Math.max(0, subtotal - manualDiscount.amount);

        return {
            subtotal: Number(subtotal.toFixed(2)),
            totalGst: Number(totalGst.toFixed(2)),
            discount: Number(manualDiscount.amount.toFixed(2)),
            total: Number(total.toFixed(2))
        };
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
            cartTotals
        }}>
            {children}
        </PosCartContext.Provider>
    );
};

export const usePosCart = () => useContext(PosCartContext);
