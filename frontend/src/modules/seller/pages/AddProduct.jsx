import React, { useState, useMemo, useRef, useEffect } from "react";
import Button from "@shared/components/ui/Button";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineArrowLeft,
  HiOutlineCube,
  HiOutlineTag,
  HiOutlineCurrencyDollar,
  HiOutlineSwatch,
  HiOutlineFolderOpen,
  HiOutlinePhoto,
  HiOutlineScale,
  HiOutlineArrowPath,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineSquaresPlus,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/core/context/AuthContext";
import { PRODUCT_UNITS, DEFAULT_PRODUCT_UNIT } from "@shared/constants/productUnits";
import axiosInstance from "@core/api/axios";
import { sellerApi } from "../services/sellerApi";
import { HiOutlineExclamationCircle } from "react-icons/hi2";
import VariantGstFields from "@shared/components/VariantGstFields";
import { useGstRates } from "@shared/hooks/useGstRates";


const AddProduct = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isVerified = user?.isVerified;
  const [modalTab, setModalTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    sku: "",
    description: "",
    price: "",
    salePrice: "",
    stock: "",
    lowStockAlert: 5,
    unit: "Pieces",
    gstRate: 0,
    category: "",
    subcategory: "",
    status: "active",
    tags: "",
    weight: "",
    brand: "",
    mainImage: null,
    masterProductId: "",
    galleryItems: [],
    variants: [
      {
        id: Date.now(),
        name: "Default",
        unit: DEFAULT_PRODUCT_UNIT,
        supplyPrice: "",
        stock: "",
        gstEnabled: false,
        gstRate: 0,
      },
    ],
  });

  const gstRates = useGstRates();

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState(false);
  const [masterCatalog, setMasterCatalog] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [dbCategories, setDbCategories] = useState([]);
  const [isLoadingCats, setIsLoadingCats] = useState(true);

  React.useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await sellerApi.getCategoryTree();
        if (res.data.success) {
          setDbCategories(res.data.results || res.data.result || []);
        }
      } catch (error) {
        toast.error("Failed to load categories");
      } finally {
        setIsLoadingCats(false);
      }
    };
    fetchCats();
  }, []);

  const categories = dbCategories;

  const handleSave = async () => {
    if (isSaving) return;
    if (!isVerified) {
      toast.error("Your profile is not approved yet. You cannot add products until admin verifies your account.");
      return;
    }
    // Validate required fields
    if (!formData.name) {
      toast.error("Please fill in the Product Title");
      return;
    }

    // Validate all three category levels are selected
    if (!formData.category || !formData.subcategory) {
      toast.error("Please select parent category and subcategory");
      return;
    }

    const firstVariant = formData.variants[0] || {};
    const firstSupply = Number(firstVariant.supplyPrice ?? firstVariant.price);
    if (!Number.isFinite(firstSupply) || firstSupply <= 0 || !firstVariant.stock) {
      toast.error("Main variant must have supply price and stock");
      return;
    }

    setIsSaving(true);
    try {
      const data = new FormData();

      const resolvedSupply =
        formData.price !== undefined && formData.price !== null && String(formData.price).trim() !== ""
          ? Number(formData.price)
          : firstSupply;
      const resolvedStock = (formData.variants || []).reduce(
        (sum, v) => sum + (Number(v.stock) || 0),
        0,
      );

      const fields = [
        'name', 'description', 'stock', 'lowStockAlert', 'unit', 'tags', 'weight',
        'brand', 'shelfLife', 'countryOfOrigin', 'fssaiLicense',
        'customerCare', 'masterProductId', 'status',
      ];

      fields.forEach(field => {
        if (formData[field] !== undefined && formData[field] !== null) {
          data.append(field, formData[field]);
        }
      });

      data.set("supplyPrice", Number.isFinite(resolvedSupply) ? resolvedSupply : 0);
      data.set("purchasePrice", Number.isFinite(resolvedSupply) ? resolvedSupply : 0);
      data.set("price", Number.isFinite(resolvedSupply) ? resolvedSupply : 0);
      data.set("stock", Number.isFinite(resolvedStock) ? resolvedStock : 0);

      data.append("categoryId", formData.category);
      data.append("subcategoryId", formData.subcategory);
      
      const syncedVariants = (formData.variants || []).map((v) => {
        const supply = Number(v.supplyPrice ?? v.price) || resolvedSupply;
        const gstEnabled = Boolean(v.gstEnabled);
        return {
          name: v.name || 'Default',
          unit: v.unit || formData.unit || DEFAULT_PRODUCT_UNIT,
          supplyPrice: supply,
          purchasePrice: supply,
          price: supply,
          stock: Number(v.stock) || 0,
          gstEnabled,
          gstRate: gstEnabled ? Math.max(0, Number(v.gstRate) || 0) : 0,
        };
      });
      data.append("variants", JSON.stringify(syncedVariants));

      if (formData.mainImageFile) {
        data.append("mainImage", formData.mainImageFile);
      }
      
      // Gallery: send new files + tell backend which existing URLs to keep
      const galleryFiles = (formData.galleryItems || []).filter(it => !!it?.file).map(it => it.file);
      galleryFiles.forEach((file) => {
        data.append("galleryImages", file);
      });
      // For updates, send existing URLs to keep (unused on create but harmless)
      const keepGalleryImages = (formData.galleryItems || [])
        .filter(it => !it?.file && typeof it?.preview === 'string')
        .map(it => it.preview);
      if (keepGalleryImages.length > 0) {
        data.append('keepGalleryImages', JSON.stringify(keepGalleryImages));
      }
      
      await sellerApi.createProduct(data);
      toast.success("Product saved successfully!");
      navigate("/seller/products");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e, type) => {
    const selected = Array.from(e?.target?.files || []);
    if (selected.length === 0) return;

    if (type === "main") {
      const file = selected[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, mainImage: reader.result, mainImageFile: file }));
      };
      reader.readAsDataURL(file);
      return;
    }

    // Gallery: allow multiple (max 5 total)
    const remainingSlots = Math.max(0, 5 - (formData.galleryItems?.length || 0));
    const filesToAdd = selected.slice(0, remainingSlots);
    if (filesToAdd.length < selected.length) toast.message("Max 5 gallery images allowed");

    filesToAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          galleryItems: [
            ...(prev.galleryItems || []),
            { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, preview: reader.result, file },
          ],
        }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeGalleryItem = (id) => {
    setFormData(prev => ({
      ...prev,
      galleryItems: (prev.galleryItems || []).filter(it => it.id !== id),
    }));
  };

  const handleNameChange = async (e) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, name: val, masterProductId: "" })); // Clear mapping if user types manually
    
    if (val.trim().length < 3) { // Increased threshold to 3 for better relevance
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      // Fetch specifically from Admin products (Master Catalog) using global endpoint
      const res = await axiosInstance.get('/products', { 
        params: { search: val, limit: 20, ownerType: 'admin', status: 'active' } 
      });
      const items = res.data?.result?.items || res.data?.items || [];
      setSuggestions(items);
      setShowSuggestions(true);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchMasterCatalog = async () => {
    setIsBrowseModalOpen(true);
    setIsCatalogLoading(true);
    try {
      const res = await axiosInstance.get('/products', { 
        params: { limit: 100, ownerType: 'admin', status: 'active' } 
      });
      const items = res.data?.result?.items || res.data?.items || [];
      setMasterCatalog(items);
    } catch (err) {
      toast.error("Failed to load catalog");
    } finally {
      setIsCatalogLoading(false);
    }
  };

  const selectSuggestion = (prod) => {
    const masterVariants =
      Array.isArray(prod.variants) && prod.variants.length > 0
        ? prod.variants.map((mv, i) => ({
            id: Date.now() + i,
            name: mv.name || "Default",
            unit: mv.unit || prod.unit || DEFAULT_PRODUCT_UNIT,
            supplyPrice: "",
            stock: "",
            gstEnabled: Boolean(mv.gstEnabled),
            gstRate: Number(mv.gstRate) || 0,
          }))
        : null;

    setFormData(prev => ({
      ...prev,
      name: prod.name,
      description: prod.description || '',
      masterProductId: prod._id,
      gstRate: prod.gstRate || 0,
      brand: prod.brand || '',
      category: prod.categoryId?._id || prod.categoryId || '',
      subcategory: prod.subcategoryId?._id || prod.subcategoryId || '',
      weight: prod.weight || '',
      unit: prod.unit || 'Pieces',
      tags: Array.isArray(prod.tags) ? prod.tags.join(", ") : (prod.tags || ''),
      mainImage: prod.mainImage || null,
      variants: masterVariants || prev.variants,
    }));
    setShowSuggestions(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Button
          variant="ghost"
          className="pl-0 hover:bg-transparent hover:text-primary-600"
          onClick={() => navigate(-1)}>
          <HiOutlineArrowLeft className="mr-2 h-5 w-5" />
          Back to Products
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !isVerified}
            className="min-w-[140px]">
            {isSaving ? (
              <>
                <HiOutlineArrowPath className="mr-2 h-5 w-5 animate-spin" />
                Publishing...
              </>
            ) : (
              "Save & Publish"
            )}
          </Button>
        </div>
      </div>

      {!isVerified && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800">
          <HiOutlineExclamationCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">
            Your profile is pending admin approval. You cannot add products until your account is verified.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-slate-100">
        {/* Sidebar Tabs */}
        <div className="md:w-64 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto">
          {[
            { id: "general", label: "General Info", icon: HiOutlineTag },
            { id: "variants", label: "Item Variants", icon: HiOutlineSwatch },
            { id: "category", label: "Groups", icon: HiOutlineFolderOpen },
            { id: "media", label: "Photos", icon: HiOutlinePhoto },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setModalTab(tab.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-4 py-3 rounded-md text-xs font-bold transition-all text-left",
                modalTab === tab.id
                  ? "bg-white text-primary shadow-sm ring-1 ring-slate-100"
                  : "text-slate-600 hover:bg-slate-100",
              )}>
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}

          <div className="pt-8 px-4">
            <div className="p-4 bg-emerald-50 rounded-md border border-emerald-100">
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                Status
              </p>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full bg-transparent border-none text-xs font-bold text-emerald-700 outline-none p-0 cursor-pointer focus:ring-0">
                <option value="active">PUBLISHED</option>
                <option value="inactive">DRAFT</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {modalTab === "general" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="space-y-1.5 flex flex-col relative" ref={suggestionsRef}>
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Product Title</span>
                  {formData.masterProductId && (
                    <span className="text-emerald-600 font-black animate-pulse">✓ MAPPED TO CATALOG</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    value={formData.name}
                    onChange={handleNameChange}
                    className={cn(
                      "w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all",
                      formData.masterProductId && "ring-2 ring-emerald-500/20 bg-emerald-50/30"
                    )}
                    placeholder="Search catalog or type a name..."
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isSearching && <HiOutlineArrowPath className="h-4 w-4 text-slate-400 animate-spin" />}
                    <button 
                       type="button"
                       onClick={fetchMasterCatalog}
                       className="px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-black text-slate-500 hover:text-primary hover:border-primary transition-all shadow-sm"
                    >
                      BROWSE ALL
                    </button>
                  </div>
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-[280px] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Matches in Hub Catalog</p>
                    </div>
                    {suggestions.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => selectSuggestion(p)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0 group"
                      >
                        {p.mainImage ? (
                          <img src={p.mainImage} className="w-8 h-8 rounded object-cover border border-slate-200" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                            <HiOutlineCube className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{p.name}</p>
                          <p className="text-[10px] text-slate-500 font-medium">In {p.categoryId?.name || "Catalog"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showSuggestions && suggestions.length === 0 && !isSearching && formData.name.length > 1 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 p-4 text-center animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-xs font-bold text-slate-600">No matches found in catalog.</p>
                    <p className="text-[10px] text-slate-400 mt-1">We'll create a new entry for you after approval.</p>
                  </div>
                )}
              </div>

              {/* Browse Catalog Modal Overlay */}
              {isBrowseModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                  <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">Master Catalog</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select a product to sell from hub inventory</p>
                      </div>
                      <button 
                        onClick={() => setIsBrowseModalOpen(false)}
                        className="p-2 hover:bg-white rounded-full transition-all"
                      >
                        <HiOutlinePlus className="h-6 w-6 text-slate-400 rotate-45" />
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-200 bg-slate-50/30">
                      {isCatalogLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                          <HiOutlineArrowPath className="h-10 w-10 text-primary animate-spin" />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic tracking-wider">Loading Master Catalog...</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {masterCatalog.map(p => (
                            <div 
                              key={p._id}
                              className="group p-3 bg-white rounded-2xl border border-slate-100 hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between gap-4"
                              onClick={() => {
                                selectSuggestion(p);
                                setIsBrowseModalOpen(false);
                              }}
                            >
                              <div className="flex items-center gap-4">
                                <div className="h-16 w-16 min-w-[64px] rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
                                  <img src={p.mainImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{p.name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wide">
                                      {p.categoryId?.name || 'Catalog'}
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-400 italic">Code: {p.sku || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-6 pr-2">
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Reference Price</p>
                                  <p className="text-sm font-black text-primary italic">₹{p.price}</p>
                                </div>
                                <button className="px-4 py-2 bg-primary text-white text-[10px] font-black uppercase rounded-xl hover:bg-primary-600 transition-all shadow-md shadow-primary/20">
                                  SELL THIS
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Measurement Unit <span className="text-rose-500">*</span></label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer"
                >
                  <option value="Pieces">Pieces</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="L">Liters (L)</option>
                  <option value="ml">Milliliters (ml)</option>
                  <option value="Pack">Pack</option>
                  <option value="Box">Box</option>
                  <option value="Bundle">Bundle</option>
                </select>
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  About this item
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-medium min-h-[160px] outline-none transition-all focus:ring-2 focus:ring-primary/10 resize-none overflow-y-auto"
                  placeholder="Describe the item here. If you selected from catalog, the master description will appear here..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Brand Name
                  </label>
                  <input
                    value={formData.brand}
                    onChange={(e) =>
                      setFormData({ ...formData, brand: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="e.g. Amul"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Product Code
                  </label>
                  <input
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-mono font-bold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="AUTO-GENERATED"
                  />
                </div>
              </div>
            </div>
          )}

          {modalTab === "variants" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Product Variants
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    Add different sizes, colors or weights.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setFormData({
                      ...formData,
                      variants: [
                        ...formData.variants,
                        {
                          id: Date.now(),
                          name: "",
                          unit: formData.unit || DEFAULT_PRODUCT_UNIT,
                          supplyPrice: "",
                          stock: "",
                          gstEnabled: false,
                          gstRate: 0,
                        },
                      ],
                    })
                  }
                  className="flex items-center space-x-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-all">
                  <HiOutlineSquaresPlus className="h-4 w-4" />
                  <span>ADD VARIANT</span>
                </button>
              </div>

              <div className="space-y-3">
                {(formData.variants || []).map((variant, index) => (
                  <div
                    key={variant.id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end group relative">
                    <div className="col-span-12 md:col-span-3 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Variant Name
                      </label>
                      <input
                        value={variant.name}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].name = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="e.g. 1kg Bag"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Supply Price
                      </label>
                      <input
                        type="number"
                        value={variant.supplyPrice ?? variant.price ?? ""}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].supplyPrice = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="500"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Unit
                      </label>
                      <select
                        value={variant.unit || formData.unit || DEFAULT_PRODUCT_UNIT}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].unit = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none cursor-pointer"
                      >
                        {PRODUCT_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Stock
                      </label>
                      <input
                        type="number"
                        value={variant.stock}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].stock = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="10"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end pb-1">
                      <button
                        onClick={() => {
                          if (formData.variants.length > 1) {
                            const newVariants = formData.variants.filter(
                              (_, i) => i !== index,
                            );
                            setFormData({ ...formData, variants: newVariants });
                          }
                        }}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                        <HiOutlineTrash className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="col-span-12">
                      <VariantGstFields
                        variant={variant}
                        gstRates={gstRates}
                        taxablePrice={Number(variant.supplyPrice ?? variant.price) || 0}
                        compact
                        onChange={(patch) => {
                          const newVariants = [...formData.variants];
                          newVariants[index] = { ...newVariants[index], ...patch };
                          setFormData({ ...formData, variants: newVariants });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modalTab === "category" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Parent category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value, subcategory: "" })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all">
                    <option value="">Select parent category</option>
                    {categories.map((p) => (
                      <option key={p._id || p.id} value={p._id || p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Subcategory <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.subcategory}
                    onChange={(e) =>
                      setFormData({ ...formData, subcategory: e.target.value })
                    }
                    disabled={!formData.category}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <option value="">Select subcategory</option>
                    {categories
                      .find((p) => (p._id || p.id) === formData.category)
                      ?.children?.map((sc) => (
                        <option key={sc._id || sc.id} value={sc._id || sc.id}>
                          {sc.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {modalTab === "media" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
              {/* Main Image Section */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Cover Photo
                </label>
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="w-48 aspect-square rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer overflow-hidden relative">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => handleImageUpload(e, "main")}
                    />
                    {formData.mainImage ? (
                      <img src={formData.mainImage} className="w-full h-full object-cover" alt="Cover" />
                    ) : (
                      <>
                        <HiOutlinePhoto className="h-10 w-10 text-slate-200 group-hover:text-primary transition-colors" />
                        <p className="text-[9px] font-bold text-slate-600 mt-2 uppercase tracking-widest group-hover:text-primary">
                          Upload Cover
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 pt-2">
                    <p className="text-xs font-bold text-slate-900">Choose a primary image</p>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      This image appears on search results and your main store listing. Make it clear and bright.
                    </p>
                  </div>
                </div>
              </div>

              {/* Gallery Section */}
              <div className="space-y-3 pt-6 border-t border-slate-100">
                <div className="flex items-end justify-between gap-3">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Gallery Images{" "}
                    <span className="text-slate-400 normal-case tracking-normal font-semibold">({(formData.galleryItems || []).length}/5)</span>
                  </label>
                  <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Select multiple</div>
                </div>

                {/* Drop zone */}
                <div className={cn(
                  "rounded-2xl border-2 border-dashed bg-slate-50 p-5 transition-colors relative",
                  (formData.galleryItems || []).length >= 5
                    ? "border-slate-200 opacity-60 cursor-not-allowed"
                    : "border-slate-200 hover:border-primary cursor-pointer"
                )}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={(formData.galleryItems || []).length >= 5}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                    onChange={(e) => handleImageUpload(e, "gallery")}
                  />
                  <div className="flex items-center gap-3 text-slate-500">
                    <div className="h-10 w-10 rounded-xl bg-white ring-1 ring-slate-100 flex items-center justify-center">
                      <HiOutlineSquaresPlus className="h-5 w-5" />
                    </div>
                    <div className="text-xs font-semibold">Click to add gallery images (max 5)</div>
                  </div>
                </div>

                {/* Preview grid */}
                {(formData.galleryItems || []).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(formData.galleryItems || []).map((it) => (
                      <div key={it.id} className="relative rounded-2xl overflow-hidden ring-1 ring-slate-100 bg-white aspect-square">
                        <img src={it.preview} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeGalleryItem(it.id)}
                          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center transition-all"
                          title="Remove"
                        >
                          <HiOutlinePlus className="h-4 w-4 text-slate-700 rotate-45" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 font-medium italic text-center pt-4 border-t border-slate-50">
                Quick Tip: Using WebP format at 800x800px makes your store load 3x faster.
              </p>
            </div>
          )}

          
        </div>
      </div>
    </div>
  );
};

export default AddProduct;
