import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function BarcodeSection({ orderNumber }) {
  const svgRef = useRef(null);
  const value = String(orderNumber || '').trim() || 'NA';

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        displayValue: true,
        fontSize: 12,
        height: 48,
        margin: 0,
        width: 1.4,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch (err) {
      console.error('Barcode generation failed', err);
    }
  }, [value]);

  return (
    <section className="inv-barcode">
      <h3 className="inv-section-title">Barcode</h3>
      <div className="inv-barcode-wrap">
        <svg ref={svgRef} role="img" aria-label={`Barcode for ${value}`} />
      </div>
    </section>
  );
}
