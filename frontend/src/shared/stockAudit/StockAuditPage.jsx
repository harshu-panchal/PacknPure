import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stockAuditApi } from '@core/services/stockAuditApi';
import { exportToCSV } from '@/lib/exportUtils';
import { useBarcodeWedge } from '@shared/pos/hooks/useBarcodeWedge';
import { CameraScanner } from '@shared/pos/components/CameraScanner';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import {
  HiOutlineClipboardDocumentCheck,
  HiOutlineMagnifyingGlass,
  HiOutlinePause,
  HiOutlinePlay,
  HiOutlineCheckCircle,
  HiOutlineXMark,
  HiOutlineArrowPath,
  HiOutlineArrowDownTray,
  HiOutlinePrinter,
  HiOutlineCamera,
  HiOutlinePlus,
} from 'react-icons/hi2';
import { ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_BADGE = {
  draft: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-emerald-50 text-emerald-700',
  paused: 'bg-amber-50 text-amber-700',
  completed: 'bg-blue-50 text-blue-700',
  cancelled: 'bg-rose-50 text-rose-600',
};

const LINE_STATUS = {
  matched: 'text-emerald-600 bg-emerald-50',
  short: 'text-rose-600 bg-rose-50',
  over: 'text-amber-700 bg-amber-50',
};

function statusLabel(s) {
  return String(s || '').replace(/_/g, ' ');
}

/**
 * Shared Admin + Seller Physical Stock Audit UI.
 * Scanning NEVER updates inventory — reports only.
 *
 * @param {{ role: 'admin' | 'seller' }} props
 */
export default function StockAuditPage({ role = 'admin' }) {
  const isAdmin = role === 'admin';
  const [view, setView] = useState('dashboard'); // dashboard | session | history
  const [sessions, setSessions] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('ready');
  const [manualBarcode, setManualBarcode] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    locationType: isAdmin ? 'hub' : 'seller_store',
    locationLabel: isAdmin ? 'Main Hub' : 'My Store',
    hubId: 'MAIN_HUB',
    sellerId: '',
    notes: '',
  });

  const scanLockRef = useRef(false);
  const lastScanRef = useRef({ code: '', at: 0 });

  const fetchHistory = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await stockAuditApi.list({ limit: 50 });
      setSessions(res.data?.result?.items || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load audits');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const openSession = async (id) => {
    try {
      const res = await stockAuditApi.get(id);
      setActive(res.data?.result || null);
      setView('session');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to open audit');
    }
  };

  const handleCreate = async () => {
    setBusy(true);
    try {
      const payload = isAdmin
        ? {
            locationType: createForm.locationType,
            locationLabel: createForm.locationLabel,
            hubId: createForm.hubId,
            sellerId:
              createForm.locationType === 'seller_store'
                ? createForm.sellerId || undefined
                : undefined,
            notes: createForm.notes,
          }
        : {
            locationType: 'seller_store',
            locationLabel: createForm.locationLabel || 'My Store',
            notes: createForm.notes,
          };
      const res = await stockAuditApi.create(payload);
      const session = res.data?.result;
      toast.success('Audit session created');
      setCreateOpen(false);
      setActive(session);
      setView('session');
      fetchHistory();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to create audit');
    } finally {
      setBusy(false);
    }
  };

  const runTransition = async (action) => {
    if (!active?._id) return;
    setBusy(true);
    try {
      const fn = stockAuditApi[action];
      const res = await fn(active._id);
      setActive(res.data?.result || null);
      toast.success(`Audit ${action}d`);
      fetchHistory();
    } catch (error) {
      toast.error(error?.response?.data?.message || `Failed to ${action}`);
    } finally {
      setBusy(false);
    }
  };

  const handleScan = useCallback(
    async (rawCode) => {
      const code = String(rawCode || '').trim();
      if (!code || !active?._id) return;
      if (active.status !== 'in_progress') {
        toast.error('Start the audit before scanning');
        return;
      }

      const now = Date.now();
      if (lastScanRef.current.code === code && now - lastScanRef.current.at < 350) {
        return;
      }
      if (scanLockRef.current) return;

      scanLockRef.current = true;
      lastScanRef.current = { code, at: now };
      setScannerStatus('scanning');

      try {
        const res = await stockAuditApi.scan(active._id, code);
        const result = res.data?.result;
        setActive(result?.session || null);
        setScannerStatus('added');
        const line = result?.line;
        toast.success(
          line
            ? `${line.productName}${line.variantName ? ` (${line.variantName})` : ''} → ${line.countedQty}`
            : 'Scan recorded',
        );
        setManualBarcode('');
      } catch (error) {
        setScannerStatus('error');
        toast.error(error?.response?.data?.message || 'Product not found');
      } finally {
        scanLockRef.current = false;
        setTimeout(() => setScannerStatus('ready'), 1000);
      }
    },
    [active],
  );

  useBarcodeWedge({
    enabled: view === 'session' && active?.status === 'in_progress' && !showScanner,
    onScan: handleScan,
  });

  const summary = active?.summary || {
    totalSkus: 0,
    matched: 0,
    short: 0,
    over: 0,
    totalExpected: 0,
    totalCounted: 0,
    totalDifference: 0,
  };

  const reportRows = useMemo(() => {
    return (active?.lines || []).map((line) => ({
      product: line.productName,
      variant: line.variantName,
      barcode: line.barcodeValue,
      expectedQty: line.expectedQty,
      countedQty: line.countedQty,
      difference: line.difference,
      status: String(line.status || 'matched').replace(/^./, (c) => c.toUpperCase()),
    }));
  }, [active]);

  const exportCsv = async () => {
    if (!active?._id) return;
    try {
      await stockAuditApi.downloadCsv(
        active._id,
        `stock_audit_${active.sessionCode || active._id}.csv`,
      );
      toast.success('CSV exported');
    } catch (error) {
      // Fallback client-side
      if (reportRows.length) {
        exportToCSV(reportRows, `stock_audit_${active.sessionCode || 'report'}`, {
          product: 'Product',
          variant: 'Variant',
          barcode: 'Barcode',
          expectedQty: 'Expected Qty',
          countedQty: 'Counted Qty',
          difference: 'Difference',
          status: 'Status',
        });
        toast.success('CSV exported');
      } else {
        toast.error(error?.message || 'Export failed');
      }
    }
  };

  const exportExcel = () => {
    if (!reportRows.length) {
      toast.error('No rows to export');
      return;
    }
    // Excel-friendly CSV (UTF-8 BOM) — same as project exportUtils pattern
    exportToCSV(reportRows, `stock_audit_${active.sessionCode || 'report'}_excel`, {
      product: 'Product',
      variant: 'Variant',
      barcode: 'Barcode',
      expectedQty: 'Expected Qty',
      countedQty: 'Counted Qty',
      difference: 'Difference',
      status: 'Status',
    });
    toast.success('Excel-compatible CSV downloaded');
  };

  const exportPdf = () => {
    if (!active) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 40;
    doc.setFontSize(14);
    doc.text(`Stock Audit Report — ${active.sessionCode}`, 40, y);
    y += 18;
    doc.setFontSize(10);
    doc.text(`Location: ${active.locationLabel || active.locationType}`, 40, y);
    y += 14;
    doc.text(
      `Status: ${statusLabel(active.status)} | SKUs: ${summary.totalSkus} | Matched: ${summary.matched} | Short: ${summary.short} | Over: ${summary.over}`,
      40,
      y,
    );
    y += 14;
    doc.text('Inventory was NOT modified by this audit.', 40, y);
    y += 22;

    doc.setFontSize(9);
    for (const row of reportRows) {
      if (y > 760) {
        doc.addPage();
        y = 40;
      }
      doc.text(
        `${row.product} / ${row.variant} | ${row.barcode} | Exp ${row.expectedQty} | Cnt ${row.countedQty} | Diff ${row.difference} | ${row.status}`,
        40,
        y,
        { maxWidth: 520 },
      );
      y += 14;
    }

    doc.save(`stock_audit_${active.sessionCode || 'report'}.pdf`);
    toast.success('PDF exported');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <HiOutlineClipboardDocumentCheck className="h-7 w-7 text-slate-700" />
            Physical Stock Audit
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Count with barcodes only — inventory is never updated automatically
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setView('dashboard'); fetchHistory(); }}
            className={cn('px-3 py-2 rounded-xl text-xs font-bold ring-1 ring-slate-200', view === 'dashboard' && 'bg-slate-900 text-white ring-slate-900')}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => { setView('history'); fetchHistory(); }}
            className={cn('px-3 py-2 rounded-xl text-xs font-bold ring-1 ring-slate-200', view === 'history' && 'bg-slate-900 text-white ring-slate-900')}
          >
            History
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white"
          >
            <HiOutlinePlus className="h-4 w-4" />
            New Audit
          </button>
        </div>
      </div>

      {(view === 'dashboard' || view === 'history') && (
        <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">
              {view === 'history' ? 'Audit History' : 'Recent Sessions'}
            </h2>
            <button type="button" onClick={fetchHistory} className="p-2 rounded-lg hover:bg-slate-50 text-slate-500">
              <HiOutlineArrowPath className={cn('h-4 w-4', loadingList && 'animate-spin')} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Summary</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {loadingList && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">Loading…</td></tr>
                )}
                {!loadingList && sessions.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">No audits yet</td></tr>
                )}
                {!loadingList && sessions.map((s) => (
                  <tr key={s._id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-slate-900">{s.sessionCode}</p>
                      <p className="text-[11px] text-slate-400">{s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{s.locationLabel || s.locationType}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-black uppercase', STATUS_BADGE[s.status])}>
                        {statusLabel(s.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {s.summary?.totalSkus || 0} SKUs · Δ {s.summary?.totalDifference ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openSession(s._id)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ring-1 ring-slate-200 hover:bg-white"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'session' && active && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-slate-900">{active.sessionCode}</h2>
                  <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-black uppercase', STATUS_BADGE[active.status])}>
                    {statusLabel(active.status)}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {active.locationLabel} · {active.locationType}
                  {active.hubId ? ` · ${active.hubId}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {active.status === 'draft' && (
                  <button type="button" disabled={busy} onClick={() => runTransition('start')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white">
                    <HiOutlinePlay className="h-4 w-4" /> Start Audit
                  </button>
                )}
                {active.status === 'in_progress' && (
                  <button type="button" disabled={busy} onClick={() => runTransition('pause')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white">
                    <HiOutlinePause className="h-4 w-4" /> Pause
                  </button>
                )}
                {active.status === 'paused' && (
                  <button type="button" disabled={busy} onClick={() => runTransition('resume')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white">
                    <HiOutlinePlay className="h-4 w-4" /> Resume
                  </button>
                )}
                {['in_progress', 'paused'].includes(active.status) && (
                  <button type="button" disabled={busy} onClick={() => runTransition('complete')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white">
                    <HiOutlineCheckCircle className="h-4 w-4" /> Finish Audit
                  </button>
                )}
                {['draft', 'in_progress', 'paused'].includes(active.status) && (
                  <button type="button" disabled={busy} onClick={() => runTransition('cancel')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ring-1 ring-rose-200 text-rose-600">
                    <HiOutlineXMark className="h-4 w-4" /> Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Expected', summary.totalExpected],
                ['Counted', summary.totalCounted],
                ['Difference', summary.totalDifference],
                ['SKUs', summary.totalSkus],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                  <p className="text-xl font-black text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold">Matched {summary.matched}</span>
              <span className="px-2 py-1 rounded-md bg-rose-50 text-rose-700 font-bold">Short {summary.short}</span>
              <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 font-bold">Over {summary.over}</span>
              <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 font-bold">Inventory unchanged</span>
            </div>

            {active.status === 'in_progress' && (
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      data-pos-barcode-search="true"
                      value={manualBarcode}
                      onChange={(e) => setManualBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleScan(manualBarcode);
                        }
                      }}
                      placeholder="Scan or type barcode…"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="px-3 py-2 rounded-xl ring-1 ring-slate-200 hover:bg-slate-50"
                    title="Camera scanner"
                  >
                    <HiOutlineCamera className="h-5 w-5 text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScan(manualBarcode)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                  >
                    <ScanLine className="h-4 w-4 inline mr-1" />
                    Count
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500" aria-live="polite">
                  <span className={cn(
                    'inline-block w-2 h-2 rounded-full',
                    scannerStatus === 'ready' && 'bg-emerald-500',
                    scannerStatus === 'scanning' && 'bg-amber-400 animate-pulse',
                    scannerStatus === 'added' && 'bg-blue-500',
                    scannerStatus === 'error' && 'bg-rose-500',
                  )} />
                  {scannerStatus === 'ready' && 'Scanner ready — camera / USB / Bluetooth'}
                  {scannerStatus === 'scanning' && 'Recording scan…'}
                  {scannerStatus === 'added' && 'Count +1'}
                  {scannerStatus === 'error' && 'Scan failed'}
                </div>
              </div>
            )}

            {(active.status === 'completed' || (active.lines || []).length > 0) && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ring-1 ring-slate-200">
                  <HiOutlineArrowDownTray className="h-4 w-4" /> CSV
                </button>
                <button type="button" onClick={exportExcel} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ring-1 ring-slate-200">
                  <HiOutlineArrowDownTray className="h-4 w-4" /> Excel
                </button>
                <button type="button" onClick={exportPdf} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ring-1 ring-slate-200">
                  <HiOutlinePrinter className="h-4 w-4" /> PDF
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Audit Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Variant</th>
                    <th className="px-4 py-3">Barcode</th>
                    <th className="px-4 py-3 text-right">Expected</th>
                    <th className="px-4 py-3 text-right">Counted</th>
                    <th className="px-4 py-3 text-right">Diff</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(active.lines || []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                        No scans yet — start the audit and scan barcodes
                      </td>
                    </tr>
                  )}
                  {(active.lines || []).map((line) => (
                    <tr key={line._id || line.barcodeValue} className="border-t border-slate-50">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{line.productName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{line.variantName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{line.barcodeValue}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold">{line.expectedQty}</td>
                      <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{line.countedQty}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold">{line.difference}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-black uppercase', LINE_STATUS[line.status] || LINE_STATUS.matched)}>
                          {line.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => setCreateOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider">Create Stock Audit</h3>
            {isAdmin && (
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Location</label>
                <select
                  value={createForm.locationType}
                  onChange={(e) => setCreateForm((f) => ({ ...f, locationType: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                >
                  <option value="hub">Hub</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="seller_store">Seller Store</option>
                </select>
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400">Label</label>
              <input
                value={createForm.locationLabel}
                onChange={(e) => setCreateForm((f) => ({ ...f, locationLabel: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                placeholder="e.g. Main Hub / Front Store"
              />
            </div>
            {isAdmin && createForm.locationType !== 'seller_store' && (
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Hub ID</label>
                <input
                  value={createForm.hubId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, hubId: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            )}
            {isAdmin && createForm.locationType === 'seller_store' && (
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Seller ID</label>
                <input
                  value={createForm.sellerId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, sellerId: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                  placeholder="Mongo seller ObjectId"
                />
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400">Notes</label>
              <textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none h-20"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              This audit only counts products. It will not change inventory, create orders, or affect POS.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold ring-1 ring-slate-200">Cancel</button>
              <button type="button" disabled={busy} onClick={handleCreate} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <CameraScanner
          onClose={() => setShowScanner(false)}
          onScan={(code) => {
            setShowScanner(false);
            handleScan(code);
          }}
        />
      )}
    </div>
  );
}
