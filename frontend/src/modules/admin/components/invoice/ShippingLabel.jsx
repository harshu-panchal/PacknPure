import React from 'react';
import { formatInr } from './invoiceUtils';

export default function ShippingLabel({ model }) {
  const { company, customer, parcel, payment, orderNumber, orderId } = model;

  return (
    <section className="inv-shipping-label page-break-before">
      <div className="inv-cut-line" aria-hidden="true">
        ✂ — — — — Detach shipping label — — — — ✂
      </div>

      <div className="inv-label-card">
        <div className="inv-label-top">
          <img
            src={company.logoUrl}
            alt={company.appName}
            className="inv-label-logo"
            onError={(e) => {
              e.currentTarget.src = '/packnpure-icon.svg';
            }}
          />
          <div>
            <h2 className="inv-label-brand">{company.appName}</h2>
            <p className="inv-label-tag">SHIPPING LABEL</p>
          </div>
          {parcel.expressBadge && <span className="inv-express-badge">EXPRESS</span>}
        </div>

        <div className="inv-label-ids">
          <div>
            <span className="inv-label">ORDER ID</span>
            <strong>{orderId || '—'}</strong>
          </div>
          <div>
            <span className="inv-label">ORDER NUMBER</span>
            <strong className="inv-label-order-no">{orderNumber}</strong>
          </div>
        </div>

        <div className="inv-label-ship-to">
          <span className="inv-label">SHIP TO</span>
          <p className="inv-party-name">{customer.name}</p>
          <p>
            {customer.addressLine}
            {customer.landmark ? `, ${customer.landmark}` : ''}
          </p>
          <p>
            {[customer.city, customer.state, customer.pincode].filter(Boolean).join(', ') || '—'}
          </p>
        </div>

        <div className="inv-label-meta">
          <div>
            <span className="inv-label">Delivery Zone</span>
            <strong>{parcel.deliveryZone}</strong>
          </div>
          <div>
            <span className="inv-label">Payment Type</span>
            <strong>{payment.method}</strong>
          </div>
          <div>
            <span className="inv-label">COD Amount</span>
            <strong>{payment.isCod ? formatInr(payment.codAmount) : 'N/A'}</strong>
          </div>
          <div>
            <span className="inv-label">Parcel Weight</span>
            <strong>{parcel.parcelWeight || '—'}</strong>
          </div>
          <div>
            <span className="inv-label">Item Count</span>
            <strong>{parcel.itemCount}</strong>
          </div>
          <div>
            <span className="inv-label">Fragile</span>
            <strong>{parcel.fragile ? 'YES — HANDLE WITH CARE' : 'No'}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
