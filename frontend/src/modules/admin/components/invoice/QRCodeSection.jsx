import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QRCodeSection({ model }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    const payload = JSON.stringify({
      orderId: model.orderId,
      orderNumber: model.orderNumber,
      customer: model.customer?.name,
      trackingUrl: model.trackingUrl || undefined,
    });

    QRCode.toDataURL(payload, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((err) => {
        console.error('QR generation failed', err);
      });

    return () => {
      cancelled = true;
    };
  }, [model.orderId, model.orderNumber, model.customer?.name, model.trackingUrl]);

  return (
    <section className="inv-qr">
      <h3 className="inv-section-title">QR Code</h3>
      <div className="inv-qr-wrap">
        {dataUrl ? (
          <img src={dataUrl} alt="Order QR Code" className="inv-qr-img" />
        ) : (
          <div className="inv-qr-placeholder">Generating…</div>
        )}
        <p className="inv-qr-caption">
          Scan for order ID, customer &amp; tracking
        </p>
      </div>
    </section>
  );
}
