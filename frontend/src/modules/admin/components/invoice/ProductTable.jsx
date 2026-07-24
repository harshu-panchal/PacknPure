import React from 'react';
import { formatInr } from './invoiceUtils';

export default function ProductTable({ lineItems }) {
  return (
    <section className="inv-products">
      <h3 className="inv-section-title">Order Details</h3>
      <table className="inv-table">
        <thead>
          <tr>
            <th className="inv-col-img">Image</th>
            <th>Product Name</th>
            <th>Variant</th>
            <th>SKU</th>
            <th>HSN</th>
            <th className="num">Unit Price</th>
            <th className="num">Qty</th>
            <th className="num">GST %</th>
            <th className="num">GST Amt</th>
            <th className="num">Discount</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item) => (
            <tr key={item.key}>
              <td className="inv-col-img">
                {item.image ? (
                  <img src={item.image} alt="" className="inv-item-img" />
                ) : (
                  <div className="inv-item-img inv-item-img--empty" />
                )}
              </td>
              <td>{item.name}</td>
              <td>{item.variant}</td>
              <td>{item.sku}</td>
              <td>{item.hsn}</td>
              <td className="num">{formatInr(item.unitPrice)}</td>
              <td className="num">{item.quantity}</td>
              <td className="num">{item.gstRate}%</td>
              <td className="num">{formatInr(item.gstAmount)}</td>
              <td className="num">{formatInr(item.discount)}</td>
              <td className="num">{formatInr(item.total)}</td>
            </tr>
          ))}
          {lineItems.length === 0 && (
            <tr>
              <td colSpan={11} className="inv-empty">
                No items in this order
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
