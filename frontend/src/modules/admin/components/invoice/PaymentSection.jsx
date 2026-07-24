import React from 'react';
import { formatDateTime, formatInr } from './invoiceUtils';

export default function PaymentSection({ payment }) {
  return (
    <section className="inv-payment">
      <h3 className="inv-section-title">Payment</h3>
      <div className="inv-payment-grid">
        <div>
          <span className="inv-label">Payment Method</span>
          <strong>{payment.method}</strong>
        </div>
        <div>
          <span className="inv-label">Cash</span>
          <strong>{payment.isCash ? 'Yes' : 'No'}</strong>
        </div>
        <div>
          <span className="inv-label">Online</span>
          <strong>{payment.isOnline ? 'Yes' : 'No'}</strong>
        </div>
        <div>
          <span className="inv-label">UPI</span>
          <strong>{payment.isUpi ? 'Yes' : 'No'}</strong>
        </div>
        <div>
          <span className="inv-label">COD</span>
          <strong>
            {payment.isCod
              ? `Yes${payment.codAmount ? ` (${formatInr(payment.codAmount)})` : ''}`
              : 'No'}
          </strong>
        </div>
        <div>
          <span className="inv-label">Transaction Id</span>
          <strong>{payment.transactionId}</strong>
        </div>
        <div>
          <span className="inv-label">Payment Time</span>
          <strong>{formatDateTime(payment.paymentTime)}</strong>
        </div>
        <div>
          <span className="inv-label">Payment Status</span>
          <strong>{payment.status}</strong>
        </div>
      </div>
    </section>
  );
}
