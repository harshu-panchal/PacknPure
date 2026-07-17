import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, PackageSearch, Store, Boxes, AlertTriangle, Flame, ScanLine } from 'lucide-react';
import { posApi } from '../../services/posApi';
import { usePosCart } from '../../context/PosCartContext';
import { toast } from 'sonner';
import { CameraScanner } from './CameraScanner';

export const ProductSearch = () => {
    const { addToCart } = usePosCart();
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const searchInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Auto focus on mount and listen to F2
    useEffect(() => {
        searchInputRef.current?.focus();

        const handleKeyDown = (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const executeSearch = async (query) => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        try {
            setIsSearching(true);
            const { data } = await posApi.searchProducts({ search: query, limit: 10 });
            if (data.success) {
                setResults(data.results || []);
            }
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setIsSearching(false);
        }
    };

    // Quick Grid Items (Could be fetched from API in future, hardcoded staples for now)
    const quickItems = [
        { name: "Basmati Rice 5kg", query: "rice" },
        { name: "Atta 10kg", query: "atta" },
        { name: "Sugar 1kg", query: "sugar" },
        { name: "Mustard Oil 1L", query: "oil" },
        { name: "Eggs (Tray)", query: "egg" },
        { name: "Bread", query: "bread" }
    ];

    const handleQuickItemClick = (query) => {
        setSearchTerm(query);
        executeSearch(query);
        searchInputRef.current?.focus();
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setSearchTerm(val);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        
        // Normal debounce
        typingTimeoutRef.current = setTimeout(() => {
            executeSearch(val);
        }, 300);
    };

    const handleKeyDown = async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            
            // Bypass debounce and search immediately
            setIsSearching(true);
            try {
                const { data } = await posApi.searchProducts({ search: searchTerm, limit: 10 });
                if (data.success && data.results?.length === 1) {
                    // Exact barcode match -> Add directly to cart and clear
                    const item = data.results[0];
                    // Instead of failing if out of stock, we add it, and let the Cart explicitly show "Procurement Required"
                    addToCart(item, null, item.hubAvailableQty || 0);
                    setSearchTerm('');
                    setResults([]);
                    toast.success(`Added ${item.name}`);
                } else if (data.success) {
                    setResults(data.results || []);
                }
            } catch (err) {
                toast.error("Barcode search failed");
            } finally {
                setIsSearching(false);
            }
        }
    };

    const handleProductSelect = (product) => {
        // Allow adding to cart even if 0 stock, the Cart logic handles Procurement orchestration.
        addToCart(product, null, product.hubAvailableQty || 0);
        setSearchTerm('');
        setResults([]);
        searchInputRef.current?.focus();
    };

    const handleScan = (decodedText) => {
        setShowScanner(false);
        setSearchTerm(decodedText);
        executeSearch(decodedText);
        // Also simulate enter press to auto-add if it's a direct barcode match
        setTimeout(() => {
            handleKeyDown({ key: 'Enter', preventDefault: () => {} });
        }, 500);
    };

    return (
        <div className="relative w-full">
            <div className="relative flex items-center">
                <Search className="absolute left-3 text-gray-400 w-5 h-5" />
                <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Scan Barcode or Search by SKU / Name (F2)"
                    className="w-full pl-10 pr-12 py-4 bg-white border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-medium"
                    autoComplete="off"
                />
                
                <button 
                    onClick={() => setShowScanner(true)}
                    className="absolute right-4 p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Open Camera Scanner"
                >
                    <ScanLine className="w-5 h-5" />
                </button>

                {isSearching && (
                    <Loader2 className="absolute right-14 text-blue-500 w-5 h-5 animate-spin" />
                )}
            </div>

            {showScanner && (
                <CameraScanner 
                    onScan={handleScan} 
                    onClose={() => setShowScanner(false)} 
                />
            )}

            {/* Dropdown Results - Deep Inventory View */}
            {results.length > 0 && searchTerm && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-[500px] overflow-y-auto divide-y divide-gray-100">
                    {results.map((product) => {
                        const hubStock = product.hubAvailableQty || 0;
                        const isLowStock = hubStock > 0 && hubStock <= 5;
                        const isOutOfStock = hubStock === 0;

                        return (
                            <div
                                key={product._id + (product.variantId ? product.variantId : '')}
                                onClick={() => handleProductSelect(product)}
                                className="flex items-start p-4 hover:bg-blue-50 cursor-pointer transition-colors"
                            >
                                <div className="w-16 h-16 bg-gray-100 rounded-lg mr-4 flex-shrink-0 overflow-hidden border border-gray-200">
                                    {product.image ? (
                                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <PackageSearch className="w-8 h-8 m-4 text-gray-300" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-bold text-gray-900 truncate pr-4">{product.name}</h4>
                                        <div className="text-right flex-shrink-0">
                                            <div className="font-black text-green-700 text-lg">Price: ₹{product.price || 0}</div>
                                            <div className="text-xs text-gray-500 line-through">MRP: ₹{product.mrp || 0}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="text-xs text-gray-500 mb-2 flex items-center gap-3">
                                        {product.variantName && <span className="bg-gray-100 px-2 py-0.5 rounded font-medium text-gray-700">{product.variantName}</span>}
                                        <span>SKU: {product.sku || 'N/A'}</span>
                                        <span>GST: {product.gstRate || 0}%</span>
                                    </div>

                                    {/* Inventory Breakdown */}
                                    <div className="flex items-center gap-4 text-xs font-semibold mt-3">
                                        <div className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                            <Boxes className="w-3.5 h-3.5" />
                                            Hub Stock: {product.hubTotalQty || 0} (Avail: {hubStock}, Res: {product.hubReservedQty || 0})
                                        </div>
                                        <div className="flex items-center gap-1.5 text-purple-700 bg-purple-50 px-2 py-1 rounded">
                                            <Store className="w-3.5 h-3.5" />
                                            Seller Stock: {product.sellerQty || 'Unknown'}
                                        </div>
                                        
                                        {isOutOfStock ? (
                                            <div className="flex items-center gap-1.5 text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 ml-auto">
                                                <AlertTriangle className="w-3.5 h-3.5" /> Out of Stock (Requires Procurement)
                                            </div>
                                        ) : isLowStock ? (
                                            <div className="flex items-center gap-1.5 text-orange-700 bg-orange-50 px-2 py-1 rounded border border-orange-200 ml-auto">
                                                <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {/* Quick Product Grid */}
            {!results.length && !searchTerm && (
                <div className="mt-4">
                    <div className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-600">
                        <Flame className="w-4 h-4 text-orange-500" />
                        Frequently Sold
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {quickItems.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleQuickItemClick(item.query)}
                                className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm font-semibold text-gray-700 text-center truncate"
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
