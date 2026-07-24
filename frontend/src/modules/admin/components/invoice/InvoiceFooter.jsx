import React from 'react';
import { formatDateTime } from './invoiceUtils';

export default function InvoiceFooter({ model }) {
  return (
    <footer className="inv-footer">
      <p className="inv-thanks">Thank You</p>
      <p className="inv-footer-brand">{model.company.appName}</p>
      <p className="inv-footer-meta">
        Generated Automatically · {formatDateTime(model.generatedAt)} · System User:{' '}
        {model.systemUser}
      </p>
    </footer>
  );
}
