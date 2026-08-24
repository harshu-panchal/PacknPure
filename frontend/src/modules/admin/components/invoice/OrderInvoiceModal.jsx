import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer, X } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { useAuth } from '@core/context/AuthContext';
import OrderInvoiceDocument from './OrderInvoiceDocument';
import { buildInvoiceViewModel } from './invoiceUtils';
import { exportAdminInvoicePdf } from './exportAdminInvoicePdf';
import './PrintStyles.css';

/**
 * Full-screen invoice preview for a single admin order.
 */
export default function OrderInvoiceModal({ isOpen, onClose, order }) {
  const { settings } = useSettings();
  const { user } = useAuth();

  const systemUser =
    user?.name || user?.email || user?.phone || user?.role || 'Admin';

  const handlePrint = (e) => {
    e?.stopPropagation();
    window.print();
  };

  const handleSavePdf = async (e) => {
    e?.stopPropagation();
    if (!order) return;
    const model = buildInvoiceViewModel(order, settings, systemUser);
    await exportAdminInvoicePdf(model);
  };

  const handleClose = (e) => {
    e?.stopPropagation();
    onClose?.();
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

    return () => {
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
      onClick={handleClose}
    >
      <div
        className="admin-invoice-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-invoice-toolbar no-print">
          <div className="admin-invoice-toolbar-header">
            <h2>Invoice · #{order.displayOrderNumber || order.orderId || order._id}</h2>
          </div>
          <div className="admin-invoice-toolbar-actions">
            <button
              type="button"
              className="admin-invoice-btn admin-invoice-btn--primary"
              onClick={handlePrint}
            >
              <Printer size={14} />
              Print / Browser Print
            </button>
            <button
              type="button"
              className="admin-invoice-btn"
              onClick={handleSavePdf}
            >
              <Download size={14} />
              Save as PDF
            </button>
            <button
              type="button"
              className="admin-invoice-btn admin-invoice-btn--close"
              onClick={handleClose}
              aria-label="Close invoice preview"
            >
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
