import React from 'react';

export default function PackingSlip({ lineItems }) {
  return (
    <section className="inv-packing">
      <h3 className="inv-section-title">Packing Slip — Items to Pack</h3>
      <ul className="inv-packing-list">
        {lineItems.map((item) => (
          <li key={item.key} className="inv-packing-item">
            <span className="inv-checkbox" aria-hidden="true">
              ☐
            </span>
            <span>
              {item.name}
              {item.variant && item.variant !== '—' ? ` ${item.variant}` : ''}{' '}
              <strong>x{item.quantity}</strong>
            </span>
          </li>
        ))}
        {lineItems.length === 0 && <li className="inv-empty">No items to pack</li>}
      </ul>
    </section>
  );
}
