import React from 'react';
import { formatInr } from './invoiceUtils';

export default function SummarySection({ summary }) {
  const rows = [
    { label: 'Subtotal', value: summary.subtotal },
    { label: 'Discount', value: summary.discount },
    { label: 'Coupon Discount', value: summary.couponDiscount },
    { label: 'Delivery Charges', value: summary.deliveryCharges },
    { label: 'Packing Charges', value: summary.packingCharges },
    { label: 'Platform Charges', value: summary.platformCharges },
    { label: 'Tax (GST)', value: summary.tax },
  ];

  if (summary.tip > 0) {
    rows.push({ label: 'Tip', value: summary.tip });
  }

  return (
    <section className="inv-summary">
      <h3 className="inv-section-title">Order Summary</h3>
      <div className="inv-summary-box">
        {rows.map((row) => (
          <div key={row.label} className="inv-summary-row">
            <span>{row.label}</span>
            <strong>{formatInr(row.value)}</strong>
          </div>
        ))}
        <div className="inv-summary-row inv-summary-row--total">
          <span>Grand Total</span>
          <strong>{formatInr(summary.grandTotal)}</strong>
        </div>
        <div className="inv-summary-row">
          <span>Paid Amount</span>
          <strong>{formatInr(summary.paidAmount)}</strong>
        </div>
        <div className="inv-summary-row">
          <span>Remaining Amount</span>
          <strong>{formatInr(summary.remainingAmount)}</strong>
        </div>
      </div>
    </section>
  );
}
