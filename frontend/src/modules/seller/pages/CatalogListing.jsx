import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Badge from "@shared/components/ui/Badge";
import Modal from "@shared/components/ui/Modal";
import Pagination from "@shared/components/ui/Pagination";
import ShimmerButton from "@/components/ui/shimmer-button";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/core/context/AuthContext";
import { useDebouncedValue, DEBOUNCE_MS } from "@shared/hooks/useDebounce";
import { sellerApi } from "../services/sellerApi";
import {
  catalogVariantRowsFromMaster,
  validateCatalogListingRows,
  buildCatalogListingFormData,
} from "../utils/sellerProductForm";
import {
  HiOutlineMagnifyingGlass,
  HiOutlineCube,
  HiOutlinePlus,
  HiOutlineCheckCircle,
  HiOutlineSwatch,
  HiOutlineCurrencyDollar,
  HiOutlineArchiveBox,
  HiOutlineArrowPath,
  HiOutlineSquaresPlus,
  HiOutlineExclamationCircle,
} from "react-icons/hi2";
import VariantGstFields from "@shared/components/VariantGstFields";
import { useGstRates } from "@shared/hooks/useGstRates";

const resolveId = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
};

const CatalogListing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isVerified = user?.isVerified;
  const gstRates = useGstRates();

  const [catalog, setCatalog] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, DEBOUNCE_MS.search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [total, setTotal] = useState(0);

  const [selectedMaster, setSelectedMaster] = useState(null);
  const [variantRows, setVariantRows] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const listingByMasterId = useMemo(() => {
    const map = new Map();
    for (const listing of myListings) {
      const mid = resolveId(listing.masterProductId);
      if (mid) map.set(mid, listing);
    }
    return map;
  }, [myListings]);

  const fetchMyListings = useCallback(async () => {
    try {
      const res = await sellerApi.getProducts({ page: 1, limit: 100 });
      const payload = res.data?.result || {};
      const items = Array.isArray(payload.items)
        ? payload.items
        : res.data?.results || [];
      setMyListings(items);
    } catch {
      toast.error("Failed to load your store listings");
    }
  }, []);

  const fetchCatalog = useCallback(
    async (requestedPage = 1) => {
      setIsLoading(true);
      try {
        const res = await sellerApi.getMasterCatalog({
          page: requestedPage,
          limit: pageSize,
          search: debouncedSearch.trim() || undefined,
        });
        const payload = res.data?.result || {};
        const items = Array.isArray(payload.items)
          ? payload.items
          : res.data?.results || [];
        setCatalog(items);
        setTotal(typeof payload.total === "number" ? payload.total : items.length);
        setPage(typeof payload.page === "number" ? payload.page : requestedPage);
      } catch {
        toast.error("Failed to load hub catalog");
      } finally {
        setIsLoading(false);
      }
    },
    [debouncedSearch, pageSize],
  );

  useEffect(() => {
    fetchMyListings();
  }, [fetchMyListings]);

  useEffect(() => {
    fetchCatalog(1);
  }, [debouncedSearch, pageSize, fetchCatalog]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const stats = useMemo(() => {
    const listed = catalog.filter((p) =>
      listingByMasterId.has(resolveId(p._id || p.id)),
    ).length;
    return {
      catalogTotal: total,
      listedInView: listed,
      myStoreCount: myListings.length,
    };
  }, [catalog, listingByMasterId, total, myListings.length]);

  const openListingModal = (master) => {
    const masterId = resolveId(master._id || master.id);
    const existing = listingByMasterId.get(masterId) || null;
    setSelectedMaster(master);
    setVariantRows(catalogVariantRowsFromMaster(master, existing));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedMaster(null);
    setVariantRows([]);
  };

  const updateVariantRow = (index, field, value) => {
    setVariantRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const patchVariantRow = (index, patch) => {
    setVariantRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const handleSaveListing = async () => {
    if (!selectedMaster || isSaving) return;
    if (!isVerified) {
      toast.error(
        "Your profile is not approved yet. You cannot add catalog listings until admin verifies your account.",
      );
      return;
    }
    const missing = validateCatalogListingRows(variantRows);
    if (missing.length) {
      toast.error(`Please enter: ${missing.join(", ")}`);
      return;
    }

    const masterId = resolveId(selectedMaster._id || selectedMaster.id);
    const existingListing = listingByMasterId.get(masterId) || null;

    setIsSaving(true);
    try {
      const { data } = buildCatalogListingFormData(selectedMaster, variantRows, {
        existingListing,
      });

      if (existingListing) {
        await sellerApi.updateProduct(
          resolveId(existingListing._id || existingListing.id),
          data,
        );
        toast.success("Store listing updated");
      } else {
        await sellerApi.createProduct(data);
        toast.success("Product added to your store");
      }

      closeModal();
      await Promise.all([fetchMyListings(), fetchCatalog(page)]);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to save listing",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const hasMultipleVariants =
    Array.isArray(selectedMaster?.variants) && selectedMaster.variants.length > 1;

  return (
    <div className="p-4 sm:p-8 bg-slate-50/50 min-h-screen font-['Outfit',_sans-serif]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Hub Catalog
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Browse platform products and add them to your store with your supply
            price and stock.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ShimmerButton
            onClick={() => fetchCatalog(page)}
            className="shadow-lg"
            background="white"
            color="black"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2">
              <HiOutlineArrowPath className="h-4 w-4" /> Refresh
            </span>
          </ShimmerButton>
          <ShimmerButton
            disabled={!isVerified}
            onClick={() => navigate("/seller/products/add")}
            className="shadow-2xl"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <HiOutlineSquaresPlus className="h-4 w-4" /> List New Product
            </span>
          </ShimmerButton>
        </div>
      </div>

      {!isVerified && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800">
          <HiOutlineExclamationCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">
            Your profile is pending admin approval. You can browse the hub catalog,
            but you cannot add or update store listings until verified.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "Catalog Products",
            val: stats.catalogTotal,
            icon: HiOutlineCube,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
          {
            label: "In Your Store",
            val: stats.myStoreCount,
            icon: HiOutlineCheckCircle,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "On This Page",
            val: stats.listedInView,
            icon: HiOutlineSwatch,
            color: "text-violet-600",
            bg: "bg-violet-50",
          },
        ].map((stat, i) => (
          <BlurFade key={stat.label} delay={0.05 + i * 0.05}>
            <MagicCard className="border-none shadow-sm ring-1 ring-slate-100 p-0 bg-white">
              <div className="flex items-center gap-3 p-4">
                <div
                  className={cn(
                    "h-11 w-11 rounded-lg flex items-center justify-center shadow-sm",
                    stat.bg,
                    stat.color,
                  )}
                >
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {stat.label}
                  </p>
                  <h4 className="text-2xl font-black text-slate-900">{stat.val}</h4>
                </div>
              </div>
            </MagicCard>
          </BlurFade>
        ))}
      </div>

      <div className="mb-6 relative">
        <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search hub catalog by name or brand..."
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-2xl bg-white animate-pulse ring-1 ring-slate-100"
            />
          ))}
        </div>
      ) : catalog.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl ring-1 ring-slate-100">
          <HiOutlineCube className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-semibold">No catalog products found</p>
          <p className="text-sm text-slate-400 mt-1">
            Try a different search or list a custom product.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {catalog.map((product) => {
            const id = resolveId(product._id || product.id);
            const existing = listingByMasterId.get(id);
            const variantCount = product.variants?.length || 0;
            const categoryName =
              product.categoryId?.name || product.category?.name || "—";

            return (
              <BlurFade key={id}>
                <button
                  type="button"
                  disabled={!isVerified}
                  onClick={() => openListingModal(product)}
                  className={cn(
                    "w-full text-left rounded-2xl bg-white ring-1 ring-slate-100 overflow-hidden transition-all",
                    "hover:shadow-lg hover:ring-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40",
                    !isVerified && "opacity-60 cursor-not-allowed",
                  )}
                >
                  <div className="flex gap-3 p-4">
                    <div className="h-20 w-20 rounded-xl bg-slate-100 shrink-0 overflow-hidden">
                      {product.mainImage ? (
                        <img
                          src={product.mainImage}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-slate-300">
                          <HiOutlineCube className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-900 truncate">
                          {product.name}
                        </h3>
                        {existing ? (
                          <Badge variant="success" className="shrink-0 text-[10px]">
                            Listed
                          </Badge>
                        ) : (
                          <Badge variant="gray" className="shrink-0 text-[10px]">
                            Add
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {categoryName}
                        {product.brand ? ` · ${product.brand}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {variantCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
                            <HiOutlineSwatch className="h-3 w-3" />
                            {variantCount} variant{variantCount > 1 ? "s" : ""}
                          </span>
                        )}
                        {existing && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <HiOutlineArchiveBox className="h-3 w-3" />
                            Stock {existing.catalogStock ?? existing.stock ?? 0}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {existing ? "Update stock & price" : "Select to list"}
                    </span>
                    <HiOutlinePlus className="h-4 w-4 text-indigo-500" />
                  </div>
                </button>
              </BlurFade>
            );
          })}
        </div>
      )}

      <Pagination
        className="mt-8"
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={(p) => fetchCatalog(p)}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        loading={isLoading}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedMaster ? `List: ${selectedMaster.name}` : "List product"}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <ShimmerButton
              disabled={isSaving || !isVerified}
              onClick={handleSaveListing}
              className="shadow-lg min-w-[140px]"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-white">
                {isSaving
                  ? "Saving..."
                  : listingByMasterId.has(resolveId(selectedMaster?._id))
                    ? "Update Listing"
                    : "Add to Store"}
              </span>
            </ShimmerButton>
          </>
        }
      >
        {selectedMaster && (
          <div className="space-y-5">
            <div className="flex gap-4 p-4 rounded-xl bg-slate-50 ring-1 ring-slate-100">
              {selectedMaster.mainImage && (
                <img
                  src={selectedMaster.mainImage}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover shrink-0"
                />
              )}
              <div>
                <p className="text-sm text-slate-600">
                  Enter your <strong>supply price</strong> (what you sell to the
                  hub at) and <strong>available stock</strong>
                  {hasMultipleVariants
                    ? " for the variant(s) you supply. Other sizes are optional — leave blank to skip."
                    : "."}
                </p>
                {selectedMaster.unit && (
                  <p className="text-xs text-slate-400 mt-1">
                    Unit: {selectedMaster.unit}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {variantRows.map((row, index) => (
                <div
                  key={`${row.name}-${index}`}
                  className="p-4 rounded-xl border border-slate-200 bg-white space-y-3"
                >
                  {hasMultipleVariants && (
                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                      <HiOutlineSwatch className="h-4 w-4 text-violet-500" />
                      {row.name}
                      {row.unit ? (
                        <span className="text-xs font-medium text-slate-400">
                          ({row.unit})
                        </span>
                      ) : null}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        optional
                      </span>
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1 mb-1.5">
                        <HiOutlineCurrencyDollar className="h-3.5 w-3.5" />
                        Supply price (₹)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.supplyPrice ?? row.price ?? ""}
                        onChange={(e) =>
                          updateVariantRow(index, "supplyPrice", e.target.value)
                        }
                        placeholder="e.g. 150"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1 mb-1.5">
                        <HiOutlineArchiveBox className="h-3.5 w-3.5" />
                        Stock qty
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.stock}
                        onChange={(e) =>
                          updateVariantRow(index, "stock", e.target.value)
                        }
                        placeholder="e.g. 50"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                      />
                    </label>
                  </div>
                  <VariantGstFields
                    variant={row}
                    gstRates={gstRates}
                    taxablePrice={Number(row.supplyPrice ?? row.price) || 0}
                    compact
                    onChange={(patch) => patchVariantRow(index, patch)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CatalogListing;
