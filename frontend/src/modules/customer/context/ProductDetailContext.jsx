import React, { createContext, useContext, useRef, useState } from 'react';
import { normalizeCustomerProduct } from '@shared/utils/productDisplay';
import { customerApi } from '../services/customerApi';
import { useLocation } from './LocationContext';

const ProductDetailContext = createContext();

export const useProductDetail = () => {
    const context = useContext(ProductDetailContext);
    if (!context) {
        return {};
    }
    return context;
};

export const ProductDetailProvider = ({ children }) => {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const requestSeq = useRef(0);
    const { currentLocation } = useLocation();

    const openProduct = (product) => {
        const seq = ++requestSeq.current;
        setSelectedProduct(normalizeCustomerProduct(product));
        setIsOpen(true);

        const id = product?._id || product?.id;
        if (!id) return;

        const params = {};
        const lat = currentLocation?.latitude;
        const lng = currentLocation?.longitude;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            params.lat = lat;
            params.lng = lng;
        }

        setIsRefreshing(true);
        customerApi
            .getProductById(id, params)
            .then((res) => {
                if (requestSeq.current !== seq) return;
                if (res?.data?.success && res.data?.result) {
                    const fresh = normalizeCustomerProduct(res.data.result);
                    setSelectedProduct((prev) => ({
                        ...(prev || normalizeCustomerProduct(product)),
                        ...fresh,
                        id: fresh.id || id,
                    }));
                }
            })
            .catch(() => {
                // sheet still renders with list payload
            })
            .finally(() => {
                if (requestSeq.current === seq) setIsRefreshing(false);
            });
    };

    const closeProduct = () => {
        setIsOpen(false);
        setTimeout(() => {
            setSelectedProduct(null);
            setIsRefreshing(false);
        }, 300);
    };

    return (
        <ProductDetailContext.Provider
            value={{ selectedProduct, isOpen, isRefreshing, openProduct, closeProduct }}
        >
            {children}
        </ProductDetailContext.Provider>
    );
};
