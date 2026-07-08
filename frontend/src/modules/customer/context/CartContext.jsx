import React, { createContext, useContext, useState, useEffect, useReducer } from "react";
import { customerApi } from "../services/customerApi";
import { useAuth } from "../../../core/context/AuthContext";
import { toast } from "sonner";
import { resolveCartStockQty } from "@shared/utils/variantHelpers";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

function cartKey(productId, variantId) {
  return `${String(productId || "").trim()}::${variantId ? String(variantId).trim() : ""}`;
}

function cartReducer(state, action) {
  switch (action.type) {
    case "set":
      return Array.isArray(action.cart) ? action.cart : [];
    case "remove_key":
      return state.filter((item) => (item?.key || "") !== action.key);
    case "upsert": {
      const key = action.item?.key;
      if (!key) return state;
      const idx = state.findIndex((x) => (x?.key || "") === key);
      if (idx >= 0) {
        const next = state.slice();
        next[idx] = { ...next[idx], ...action.item };
        return next;
      }
      return [...state, action.item];
    }
    case "set_qty": {
      const key = action.key;
      const qty = Number(action.quantity) || 0;
      if (!key) return state;
      if (qty <= 0) return state.filter((item) => (item?.key || "") !== key);
      return state.map((item) => ((item?.key || "") === key ? { ...item, quantity: qty } : item));
    }
    default:
      return state;
  }
}

function loadCartFromStorage() {
  try {
    const savedCart = localStorage.getItem("cart");
    return savedCart ? JSON.parse(savedCart) : [];
  } catch (error) {
    console.error("Failed to load cart from localStorage", error);
    return [];
  }
}

function resolveVariant(product, variantId) {
  if (!variantId) return null;
  const variants = product?.variants;
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants.find((v) => String(v?._id || v?.id) === String(variantId)) || null;
}

function applyVariantToProduct(product, variantId) {
  if (!product) return product;
  const stock = resolveCartStockQty(product, variantId);
  const v = resolveVariant(product, variantId);
  if (!v) {
    return {
      ...product,
      selectedVariantId: variantId || null,
      stockQty: stock,
      inStock: stock > 0,
    };
  }
  const saleBase = Number(v.salePrice ?? v.price) || 0;
  const mrpBase = Number(v.price) || saleBase;

  return {
    ...product,
    selectedVariantId: String(v?._id || v?.id || variantId || ""),
    price: saleBase || Number(product.price || 0),
    originalPrice: mrpBase || Number(product.originalPrice || 0),
    weight: v.name || product.weight,
    variantLabel: v.name || product.variantLabel,
    stockQty: stock,
    inStock: stock > 0,
  };
}

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [cart, dispatch] = useReducer(cartReducer, undefined, loadCartFromStorage);

  const [loading, setLoading] = useState(false);
  const pendingRequestsRef = React.useRef(0);

  // Clear cart locally when user logs out is handled by the useEffect dependency on isAuthenticated
  const normalizeBackendCart = (items) => {
    if (!items) return [];
    return items.map((item) => {
      const base = {
        ...item.productId,
        selectedVariantId: item.variantId || null,
      };
      const withVariant = applyVariantToProduct(base, item.variantId);
      const productId = item.productId?._id;
      const variantId = item.variantId || null;
      return {
        ...withVariant,
        id: productId, // product id (kept for backward compat)
        productId, // explicit
        variantId, // explicit
        key: cartKey(productId, variantId),
        quantity: item.quantity,
        image: item.productId.mainImage, // Handle mapping for frontend
        variants: Array.isArray(item.productId?.variants)
          ? item.productId.variants
          : withVariant.variants,
      };
    });
  };

  const syncCart = (backendItems) => {
    // Only update state from backend if no more pending optimistic updates
    if (pendingRequestsRef.current === 0) {
      dispatch({ type: "set", cart: normalizeBackendCart(backendItems) });
    }
  };

  const fetchCart = async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        const response = await customerApi.getCart();
        dispatch({ type: "set", cart: normalizeBackendCart(response.data.result.items) });
      } catch (error) {
        console.error("Failed to fetch cart from backend", error);
      } finally {
        setLoading(false);
      }
    }
  };

let syncPromise = null;

  const syncLocalCartToBackend = async () => {
    const localCart = loadCartFromStorage();
    if (!localCart || localCart.length === 0) return;

    if (syncPromise) {
      await syncPromise;
      return;
    }

    syncPromise = (async () => {
      try {
        for (const item of localCart) {
          try {
            await customerApi.addToCart({
              productId: item.productId || item.id || item._id,
              quantity: item.quantity,
              variantId: item.variantId || item.selectedVariantId || undefined,
            });
          } catch (err) {
            console.error("Failed to sync local cart item", err);
          }
        }
        localStorage.removeItem("cart"); // Remove after successful sync
      } catch (err) {
        console.error("Failed to sync local cart to backend", err);
      }
    })();

    await syncPromise;
    syncPromise = null;
  };

  // Fetch cart from backend on mount or authentication change
  useEffect(() => {
    if (isAuthenticated) {
      const initCart = async () => {
        setLoading(true);
        await syncLocalCartToBackend();
        await fetchCart();
      };
      initCart();
    } else {
      // Clear cart state and load from local storage for guests
      dispatch({ type: "set", cart: loadCartFromStorage() });
    }
  }, [isAuthenticated]);

  // Save local cart to localStorage (fallback/guest mode)
  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.setItem("cart", JSON.stringify(cart));
    }
  }, [cart, isAuthenticated]);

  const addToCart = async (product) => {
    const id = product.id || product._id;
    const variantId = product.selectedVariantId || product.variantId || null;
    const key = cartKey(id, variantId);
    const stockCap = resolveCartStockQty(product, variantId);

    // Optimistic UI update for instant feedback
    const existingItem = cart.find((item) => (item?.key || "") === key);
    if (existingItem) {
      const merged = {
        ...existingItem,
        ...product,
        variants: product.variants || existingItem.variants,
      };
      const p = applyVariantToProduct(merged, variantId);
      const newQty = Number(existingItem.quantity || 0) + 1;
      if (typeof stockCap === "number" && newQty > stockCap) {
        toast.error(`Insufficient stock! Only ${stockCap} available.`);
        return;
      }
      dispatch({
        type: "upsert",
        item: {
          ...p,
          variants: merged.variants,
          quantity: newQty,
        },
      });
    } else {
      const p = applyVariantToProduct(product, variantId);
      if (typeof stockCap === "number" && 1 > stockCap) {
        toast.error(`Insufficient stock! Only ${stockCap} available.`);
        return;
      }
      dispatch({
        type: "upsert",
        item: {
          ...p,
          variants: product.variants,
          id,
          productId: id,
          variantId,
          key,
          quantity: 1,
          image: product.image || product.mainImage,
        },
      });
    }

    if (isAuthenticated) {
      pendingRequestsRef.current += 1;
      try {
        const response = await customerApi.addToCart({
          productId: id,
          quantity: 1,
          variantId: variantId || undefined,
        });
        pendingRequestsRef.current -= 1;
        await syncCart(response.data.result.items);
      } catch (error) {
        pendingRequestsRef.current -= 1;
        console.error("Error adding to cart on backend", error);
        toast.error(error.response?.data?.message || "Failed to add to cart");
        // Re-fetch entire cart to ensure consistency on error
        if (pendingRequestsRef.current === 0) {
          await fetchCart();
        }
      }
    }
  };

  const removeFromCart = async (productId, variantId) => {
    const key = cartKey(productId, variantId);
    // Optimistic update
    dispatch({ type: "remove_key", key });

    if (isAuthenticated) {
      pendingRequestsRef.current += 1;
      try {
        const response = await customerApi.removeFromCart(productId, variantId);
        pendingRequestsRef.current -= 1;
        await syncCart(response.data.result.items);
      } catch (error) {
        pendingRequestsRef.current -= 1;
        console.error("Error removing from cart on backend", error);
        toast.error(error.response?.data?.message || "Failed to remove from cart");
        if (pendingRequestsRef.current === 0) {
          await fetchCart();
        }
      }
    }
  };

  const updateQuantity = async (productId, delta, variantId, freshProduct = null) => {
    const key = cartKey(productId, variantId);
    const currentItem = cart.find((item) => (item?.key || "") === key);
    if (!currentItem) return;

    const merged = freshProduct
      ? {
          ...currentItem,
          ...freshProduct,
          variants: freshProduct.variants || currentItem.variants,
        }
      : currentItem;
    const stockCap = resolveCartStockQty(merged, variantId || merged.variantId || merged.selectedVariantId);

    let newQty = Math.max(0, currentItem.quantity + delta);

    if (newQty === 0) {
      removeFromCart(
        productId,
        variantId || currentItem.variantId || currentItem.selectedVariantId,
      );
      return true;
    }

    if (delta > 0 && typeof stockCap === "number" && newQty > stockCap) {
      toast.error(`Insufficient stock! Only ${stockCap} available.`);
      if (currentItem.quantity >= stockCap) {
        return false;
      }
      newQty = stockCap;
    }

    const refreshed = applyVariantToProduct(merged, variantId || merged.variantId || merged.selectedVariantId);

    // Optimistic update
    dispatch({
      type: "upsert",
      item: {
        ...refreshed,
        variants: merged.variants,
        id: productId,
        productId,
        variantId: variantId || currentItem.variantId || currentItem.selectedVariantId,
        key,
        quantity: newQty,
        image: currentItem.image || refreshed.mainImage,
      },
    });

    if (isAuthenticated) {
      pendingRequestsRef.current += 1;
      try {
        const response = await customerApi.updateCartQuantity({
          productId,
          quantity: newQty,
          variantId:
            variantId ||
            currentItem.variantId ||
            currentItem.selectedVariantId ||
            undefined,
        });
        pendingRequestsRef.current -= 1;
        await syncCart(response.data.result.items);
      } catch (error) {
        pendingRequestsRef.current -= 1;
        console.error("Error updating quantity on backend", error);
        toast.error(error.response?.data?.message || "Failed to update quantity");
        if (pendingRequestsRef.current === 0) {
          await fetchCart();
        }
        return false;
      }
    }
    return true;
  };

  const clearCart = async () => {
    if (isAuthenticated) {
      try {
        await customerApi.clearCart();
        dispatch({ type: "set", cart: [] });
      } catch (error) {
        console.error("Error clearing cart on backend", error);
      }
    } else {
      dispatch({ type: "set", cart: [] });
    }
  };

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        cartCount,
        loading,
      }}>
      {children}
    </CartContext.Provider>
  );
};
