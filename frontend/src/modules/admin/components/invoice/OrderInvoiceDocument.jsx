import React from 'react';
import InvoiceHeader from './InvoiceHeader';
import CustomerSection from './CustomerSection';
import ProductTable from './ProductTable';
import SummarySection from './SummarySection';
import PaymentSection from './PaymentSection';
import BarcodeSection from './BarcodeSection';
import QRCodeSection from './QRCodeSection';
import PackingSlip from './PackingSlip';
import ShippingLabel from './ShippingLabel';
import InvoiceFooter from './InvoiceFooter';
import {
  buildInvoiceViewModel,
  formatDate,
  formatDateTime,
} from './invoiceUtils';

export default function OrderInvoiceDocument({ order, settings, systemUser }) {
  const base = buildInvoiceViewModel(order, settings, systemUser);
  const model = {
    ...base,
    invoiceDateLabel: formatDate(base.invoiceDate),
    orderDateLabel: formatDateTime(base.orderDate),
    packingDateLabel: base.packingDate ? formatDateTime(base.packingDate) : '—',
  };

  return (
    <article id="admin-printable-invoice" className="admin-invoice-document">
      <InvoiceHeader model={model} />
      <CustomerSection model={model} />
      <ProductTable lineItems={model.lineItems} />

      <div className="inv-summary-payment-row">
        <SummarySection summary={model.summary} />
        <PaymentSection payment={model.payment} />
      </div>

      <div className="inv-codes">
        <BarcodeSection orderNumber={model.orderNumber} />
        <QRCodeSection model={model} />
      </div>

      <PackingSlip lineItems={model.lineItems} />
      <InvoiceFooter model={model} />
      <ShippingLabel model={model} />
    </article>
  );
}
