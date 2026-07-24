import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer, X } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { useAuth } from '@core/context/AuthContext';
import OrderInvoiceDocument from './OrderInvoiceDocument';
import './PrintStyles.css';

/**
 * Full-screen invoice preview for a single admin order.
 * Print / Save as PDF both use the browser print dialog (A4 + Save as PDF).
 */
export default function OrderInvoiceModal({ isOpen, onClose, order }) {
  const { settings } = useSettings();
  const { user } = useAuth();

  const systemUser =
    user?.name || user?.email || user?.phone || user?.role || 'Admin';

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdf = () => {
    // Browser "Save as PDF" is the most reliable A4 export path for HTML invoices.
    window.print();
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('admin-invoice-open');

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    // Allow barcode/QR to render, then open the browser print dialog.
    const printTimer = window.setTimeout(() => {
      window.print();
    }, 450);

    return () => {
      window.clearTimeout(printTimer);
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove('admin-invoice-open');
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  return createPortal(
    <div
      className="admin-invoice-shell"
      role="dialog"
      aria-modal="true"
      aria-label="Print Invoice"
      onClick={onClose}
    >
      <div
        className="admin-invoice-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-invoice-toolbar no-print">
          <h2>Invoice · #{order.orderId}</h2>
          <div className="admin-invoice-toolbar-actions">
            <button type="button" className="admin-invoice-btn admin-invoice-btn--primary" onClick={handlePrint}>
              <Printer size={14} />
              Print / Browser Print
            </button>
            <button type="button" className="admin-invoice-btn" onClick={handleSavePdf}>
              <Download size={14} />
              Save as PDF
            </button>
            <button type="button" className="admin-invoice-btn" onClick={onClose} aria-label="Close">
              <X size={14} />
              Close
            </button>
          </div>
        </div>

        <div className="admin-invoice-scroll">
          <OrderInvoiceDocument
            order={order}
            settings={settings}
            systemUser={systemUser}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
