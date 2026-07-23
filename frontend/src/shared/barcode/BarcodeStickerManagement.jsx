import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { barcodeApi } from '@core/services/barcodeApi';
import { toast } from 'sonner';
import {
  HiOutlineArrowDownTray,
  HiOutlineEye,
  HiOutlineFunnel,
  HiOutlineMagnifyingGlass,
  HiOutlinePrinter,
  HiOutlineQrCode,
  HiOutlineArrowPath,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';

/**
 * Preview modal: product + variant + barcode image + print/download.
 */
function BarcodePreviewModal({ open, row, onClose, onPrint, onDownload }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    let revoked = false;
    let objectUrl = null;

    const load = async () => {
      if (!open || !row?.barcodeValue) {
        setPreviewUrl(null);
        return;
      }
      setLoadingPreview(true);
      try {
        objectUrl = await barcodeApi.fetchPreviewBlobUrl(row.barcodeValue);
        if (!revoked) setPreviewUrl(objectUrl);
      } catch {
        if (!revoked) {
          setPreviewUrl(null);
          toast.error('Failed to load barcode preview');
        }
      } finally {
        if (!revoked) setLoadingPreview(false);
      }
    };

    load();
    return () => {
      revoked = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [open, row?.barcodeValue]);

  if (!open || !row) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Barcode preview"
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Barcode Preview</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Close preview"
          >
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Product</p>
            <p className="text-base font-bold text-slate-900">{row.productName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Variant</p>
            <p className="text-sm font-semibold text-slate-700">{row.variantName || '—'}</p>
          </div>

          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 flex flex-col items-center min-h-[120px] justify-center">
            {loadingPreview && <p className="text-xs text-slate-500">Loading barcode…</p>}
            {!loadingPreview && previewUrl && (
              <img src={previewUrl} alt={row.barcodeValue} className="max-w-full h-auto" />
            )}
            {!loadingPreview && !previewUrl && (
              <p className="text-xs text-rose-500">Preview unavailable</p>
            )}
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Barcode Number</p>
            <p className="font-mono text-sm font-bold text-slate-900 break-all">{row.barcodeValue}</p>
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={() => onDownload(row)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ring-1 ring-slate-200 bg-white hover:bg-slate-100"
          >
            <HiOutlineArrowDownTray className="h-4 w-4" />
            Download
          </button>
          <button
            type="button"
            onClick={() => onPrint(row)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
          >
            <HiOutlinePrinter className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Shared Admin + Seller barcode sticker management.
 * @param {{ role: 'admin' | 'seller' }} props
 */
export default function BarcodeStickerManagement({ role = 'admin' }) {
  const isAdmin = role === 'admin';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [brand, setBrand] = useState('');
  const [brands, setBrands] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [barcodeStatus, setBarcodeStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [busyKey, setBusyKey] = useState(null);
  const [previewRow, setPreviewRow] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  const loadBrandsAndCategories = useCallback(async () => {
    try {
      const brandRes = await barcodeApi.catalogBrands();
      setBrands(brandRes.data?.result?.brands || []);
    } catch {
      setBrands([]);
    }

    if (!isAdmin) {
      setCategories([]);
      return;
    }

    try {
      const { adminApi } = await import('@modules/admin/services/adminApi');
      const catRes = await adminApi.getCategories({ flat: true });
      const list = catRes.data?.results || catRes.data?.result || [];
      setCategories(Array.isArray(list) ? list : []);
    } catch {
      setCategories([]);
    }
  }, [isAdmin]);

  const fetchCatalog = useCallback(async (requestedPage = 1) => {
    setLoading(true);
    try {
      const params = {
        page: requestedPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
        brand: brand || undefined,
        categoryId: categoryId || undefined,
        barcodeStatus: barcodeStatus !== 'all' ? barcodeStatus : undefined,
        ownerType: isAdmin ? 'admin' : undefined,
      };
      const res = await barcodeApi.catalog(params);
      const payload = res.data?.result || {};
      setRows(payload.items || []);
      setTotal(payload.total || 0);
      setPage(payload.page || requestedPage);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load barcodes');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [pageSize, searchTerm, brand, categoryId, barcodeStatus, isAdmin]);

  useEffect(() => {
    loadBrandsAndCategories();
  }, [loadBrandsAndCategories]);

  useEffect(() => {
    const timer = setTimeout(() => fetchCatalog(1), 350);
    return () => clearTimeout(timer);
  }, [fetchCatalog]);

  const productGroups = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.productId)) {
        map.set(row.productId, {
          productId: row.productId,
          productName: row.productName,
          brand: row.brand,
          variants: [],
        });
      }
      map.get(row.productId).variants.push(row);
    }
    return [...map.values()];
  }, [rows]);

  const withBusy = async (key, fn) => {
    setBusyKey(key);
    try {
      await fn();
    } finally {
      setBusyKey(null);
    }
  };

  const handleGenerate = async (row) => {
    await withBusy(`gen-${row.productId}`, async () => {
      try {
        const res = await barcodeApi.ensure(row.productId);
        const generated = res.data?.result?.generated || 0;
        toast.success(
          generated > 0
            ? `Generated ${generated} barcode(s)`
            : 'No missing barcodes for this product',
        );
        fetchCatalog(page);
      } catch (error) {
        toast.error(error?.response?.data?.message || 'Failed to generate barcode');
      }
    });
  };

  const handleGenerateMissingAll = async () => {
    await withBusy('gen-missing', async () => {
      try {
        const res = await barcodeApi.ensureMissing({
          ownerType: isAdmin ? 'admin' : undefined,
          limit: 50,
        });
        const generated = res.data?.result?.generated || 0;
        toast.success(
          generated > 0
            ? `Generated ${generated} missing barcode(s)`
            : 'No missing barcodes found',
        );
        fetchCatalog(1);
      } catch (error) {
        toast.error(error?.response?.data?.message || 'Failed to generate missing barcodes');
      }
    });
  };

  const handleDownloadVariant = async (row) => {
    if (!row.hasBarcode && !row.barcodeValue) {
      toast.error('Generate barcode first');
      return;
    }
    await withBusy(`dl-${row.variantId}`, async () => {
      try {
        await barcodeApi.downloadPdf(row.productId, {
          variantIds: row.variantId ? [row.variantId] : undefined,
          filename: `barcode_${row.barcodeValue || row.variantId}.pdf`,
        });
        toast.success('Barcode PDF downloaded');
      } catch (error) {
        toast.error(error.message || 'Download failed');
      }
    });
  };

  const handlePrintVariant = async (row) => {
    if (!row.hasBarcode && !row.barcodeValue) {
      toast.error('Generate barcode first');
      return;
    }
    await withBusy(`pr-${row.variantId}`, async () => {
      try {
        await barcodeApi.printPdf(row.productId, {
          variantIds: row.variantId ? [row.variantId] : undefined,
        });
        toast.success('Opened print dialog');
      } catch (error) {
        toast.error(error.message || 'Print failed');
      }
    });
  };

  const handleBulkProduct = async (productId, productName, action) => {
    await withBusy(`${action}-${productId}`, async () => {
      try {
        if (action === 'download') {
          await barcodeApi.downloadPdf(productId, {
            filename: `barcodes_${String(productName || 'product').replace(/\s+/g, '_')}.pdf`,
          });
          toast.success('All variant stickers downloaded');
        } else {
          await barcodeApi.printPdf(productId);
          toast.success('Print all stickers opened');
        }
        fetchCatalog(page);
      } catch (error) {
        toast.error(error.message || 'Bulk action failed');
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <HiOutlineQrCode className="h-7 w-7 text-slate-700" />
            Barcode Stickers
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {isAdmin
              ? 'Preview, print, and download master catalog barcode stickers'
              : 'Manage your seller barcode stickers only'}
          </p>
        </div>
        <button
          type="button"
          disabled={busyKey === 'gen-missing'}
          onClick={handleGenerateMissingAll}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <HiOutlineArrowPath className={cn('h-4 w-4', busyKey === 'gen-missing' && 'animate-spin')} />
          Generate Missing Barcodes
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-50 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1">
              <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search product, variant, or barcode number…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <HiOutlineFunnel className="h-4 w-4 text-slate-400" />
              <select
                value={barcodeStatus}
                onChange={(e) => setBarcodeStatus(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold uppercase tracking-wide"
              >
                <option value="all">All barcodes</option>
                <option value="generated">Barcode generated</option>
                <option value="missing">Missing barcode</option>
              </select>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
              >
                <option value="">All brands</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              {isAdmin && (
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold max-w-[180px]"
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Product / Variant</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Barcode</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-sm text-slate-500">
                    Loading stickers…
                  </td>
                </tr>
              )}
              {!loading && productGroups.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-sm text-slate-500">
                    No barcode rows found
                  </td>
                </tr>
              )}
              {!loading && productGroups.map((group) => (
                <React.Fragment key={group.productId}>
                  <tr className="bg-slate-50/80 border-t border-slate-100">
                    <td className="px-4 py-3" colSpan={2}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900">{group.productName}</span>
                        {group.brand && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            {group.brand}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-400">
                          {group.variants.length} variant{group.variants.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          title="Download All Variant Stickers"
                          disabled={busyKey === `download-${group.productId}`}
                          onClick={() => handleBulkProduct(group.productId, group.productName, 'download')}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide ring-1 ring-slate-200 hover:bg-white"
                        >
                          Download All
                        </button>
                        <button
                          type="button"
                          title="Print All Variant Stickers"
                          disabled={busyKey === `print-${group.productId}`}
                          onClick={() => handleBulkProduct(group.productId, group.productName, 'print')}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide bg-slate-900 text-white hover:bg-slate-800"
                        >
                          Print All
                        </button>
                      </div>
                    </td>
                  </tr>
                  {group.variants.map((row) => (
                    <tr key={`${row.productId}-${row.variantId}`} className="border-t border-slate-50 hover:bg-slate-50/40">
                      <td className="px-4 py-3 pl-8">
                        <p className="text-sm font-semibold text-slate-800">{row.variantName || 'Variant'}</p>
                        {row.unit && <p className="text-[11px] text-slate-400">{row.unit}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {row.hasBarcode ? (
                          <code className="text-xs font-mono font-bold text-slate-700 break-all">
                            {row.barcodeValue}
                          </code>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                            Missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {!row.hasBarcode ? (
                            <button
                              type="button"
                              title="Generate Barcode"
                              disabled={busyKey === `gen-${row.productId}`}
                              onClick={() => handleGenerate(row)}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                            >
                              Generate
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                title="View / Preview"
                                onClick={() => setPreviewRow(row)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-white ring-1 ring-slate-100"
                              >
                                <HiOutlineEye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Download / Reprint"
                                disabled={busyKey === `dl-${row.variantId}`}
                                onClick={() => handleDownloadVariant(row)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-white ring-1 ring-slate-100"
                              >
                                <HiOutlineArrowDownTray className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Print / Reprint"
                                disabled={busyKey === `pr-${row.variantId}`}
                                onClick={() => handlePrintVariant(row)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-white ring-1 ring-slate-100"
                              >
                                <HiOutlinePrinter className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Page {page} of {totalPages} · {total} item{total === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => fetchCatalog(page - 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold ring-1 ring-slate-200 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => fetchCatalog(page + 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold ring-1 ring-slate-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <BarcodePreviewModal
        open={Boolean(previewRow)}
        row={previewRow}
        onClose={() => setPreviewRow(null)}
        onPrint={(row) => handlePrintVariant(row)}
        onDownload={(row) => handleDownloadVariant(row)}
      />
    </div>
  );
}
