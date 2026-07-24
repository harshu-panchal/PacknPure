import React from 'react';

export default function InvoiceHeader({ model }) {
  const { company } = model;

  return (
    <header className="inv-header">
      <div className="inv-header-brand">
        <img
          src={company.logoUrl}
          alt={company.appName}
          className="inv-logo"
          onError={(e) => {
            e.currentTarget.src = '/packnpure-icon.svg';
          }}
        />
        <div>
          <h1 className="inv-brand-name">{company.appName}</h1>
          <p className="inv-brand-sub">Admin Fulfillment Center</p>
        </div>
      </div>

      <div className="inv-header-meta">
        <h2 className="inv-title">INVOICE</h2>
        <dl className="inv-meta-grid">
          <div>
            <dt>Invoice Number</dt>
            <dd>{model.invoiceNumber}</dd>
          </div>
          <div>
            <dt>Order Number</dt>
            <dd>{model.orderNumber}</dd>
          </div>
          <div>
            <dt>Invoice Date</dt>
            <dd>{model.invoiceDateLabel}</dd>
          </div>
          <div>
            <dt>Order Date</dt>
            <dd>{model.orderDateLabel}</dd>
          </div>
          <div>
            <dt>Packing Date</dt>
            <dd>{model.packingDateLabel}</dd>
          </div>
          <div>
            <dt>Payment Status</dt>
            <dd>{model.paymentStatus}</dd>
          </div>
          <div>
            <dt>Order Status</dt>
            <dd>{model.orderStatus}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
