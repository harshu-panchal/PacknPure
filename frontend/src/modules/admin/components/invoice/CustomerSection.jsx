import React from 'react';

export default function CustomerSection({ model }) {
  const { company, customer } = model;

  return (
    <section className="inv-parties">
      <div className="inv-party">
        <h3 className="inv-section-title">Seller / Company</h3>
        <p className="inv-party-name">{company.name}</p>
        <p>{company.address}</p>
        <p>
          <strong>GST:</strong> {company.gst}
        </p>
        <p>
          <strong>Email:</strong> {company.email}
        </p>
        <p>
          <strong>Phone:</strong> {company.phone}
        </p>
        <p>
          <strong>Website:</strong> {company.website}
        </p>
      </div>

      <div className="inv-party">
        <h3 className="inv-section-title">Customer Details</h3>
        <p className="inv-party-name">{customer.name}</p>
        <p>
          <strong>Delivery Address:</strong> {customer.addressLine}
          {customer.landmark ? `, ${customer.landmark}` : ''}
        </p>
        <p>
          <strong>City:</strong> {customer.city || '—'}
        </p>
        <p>
          <strong>State:</strong> {customer.state || '—'}
        </p>
        <p>
          <strong>Pincode:</strong> {customer.pincode || '—'}
        </p>
      </div>
    </section>
  );
}
