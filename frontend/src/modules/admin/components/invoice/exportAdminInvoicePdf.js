import { formatInr } from './invoiceUtils';

/**
 * Programmatically generates and downloads an A4 PDF for an Admin Order Invoice.
 */
export async function exportAdminInvoicePdf(model) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF('p', 'mm', 'a4');

    const pw = doc.internal.pageSize.getWidth(); // 210mm
    const ph = doc.internal.pageSize.getHeight(); // 297mm
    let y = 14;

    const checkPageBreak = (needed = 15) => {
      if (y + needed > ph - 14) {
        doc.addPage();
        y = 14;
      }
    };

    // --- Header Section ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // #0f172a
    doc.text(String(model.company.appName || 'PACK N PURE').toUpperCase(), 14, y);

    doc.setFontSize(14);
    doc.text('INVOICE', pw - 14, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // #475569
    doc.text(model.sellerName ? `Seller: ${model.sellerName}` : 'Admin Fulfillment Center', 14, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`INV #: ${model.invoiceNumber}`, pw - 14, y, { align: 'right' });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Order Date: ${model.orderDateLabel}`, 14, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Order #: ${model.orderNumber}`, pw - 14, y, { align: 'right' });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Invoice Date: ${model.invoiceDateLabel}`, 14, y);
    doc.text(`Status: ${model.orderStatus} | Payment: ${model.paymentStatus}`, pw - 14, y, { align: 'right' });
    y += 7;

    // Divider Line
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.line(14, y, pw - 14, y);
    y += 8;

    // --- Parties Section (2 columns) ---
    const colWidth = (pw - 36) / 2;
    const rightColX = 14 + colWidth + 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('SELLER / COMPANY', 14, y);
    doc.text('CUSTOMER DETAILS', rightColX, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(model.company.name || 'Pack n Pure', 14, y);
    doc.text(model.customer.name || 'Customer', rightColX, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    // Company info lines
    doc.text(`GST: ${model.company.gst || '—'}`, 14, y);
    // Customer phone
    doc.text(`Phone: ${model.customer.phone || '—'}`, rightColX, y);
    y += 4.5;

    doc.text(`Email: ${model.company.email || '—'}`, 14, y);
    doc.text(`Email: ${model.customer.email || '—'}`, rightColX, y);
    y += 4.5;

    doc.text(`Phone: ${model.company.phone || '—'}`, 14, y);
    doc.text(`Address: ${model.customer.addressLine}`, rightColX, y, { maxWidth: colWidth });
    y += 4.5;

    doc.text(`Website: ${model.company.website || '—'}`, 14, y);
    const locationLine = [model.customer.city, model.customer.state, model.customer.pincode].filter((s) => s && s !== '—').join(', ');
    if (locationLine) {
      doc.text(`City/State/Pin: ${locationLine}`, rightColX, y, { maxWidth: colWidth });
    }
    y += 8;

    // --- Product Table ---
    checkPageBreak(30);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('ORDER DETAILS', 14, y);
    y += 4;

    // Table Header background
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, pw - 28, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    doc.text('#', 17, y + 4.5);
    doc.text('ITEM NAME', 26, y + 4.5);
    doc.text('SKU', 95, y + 4.5);
    doc.text('QTY', 125, y + 4.5, { align: 'center' });
    doc.text('UNIT PRICE', 150, y + 4.5, { align: 'right' });
    doc.text('GST', 172, y + 4.5, { align: 'right' });
    doc.text('TOTAL', pw - 17, y + 4.5, { align: 'right' });
    y += 9;

    // Table Rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    model.lineItems.forEach((item, idx) => {
      checkPageBreak(12);

      doc.text(String(idx + 1), 17, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(item.name || ''), 26, y, { maxWidth: 65 });
      doc.setFont('helvetica', 'normal');
      doc.text(String(item.sku || '—'), 95, y, { maxWidth: 26 });
      doc.text(String(item.quantity || 1), 125, y, { align: 'center' });
      doc.text(formatInr(item.unitPrice), 150, y, { align: 'right' });
      doc.text(formatInr(item.gstAmount), 172, y, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatInr(item.total), pw - 17, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += 4;
      if (item.variant && item.variant !== '—') {
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Variant: ${item.variant}`, 26, y);
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        y += 4;
      }

      doc.setDrawColor(226, 232, 240);
      doc.line(14, y, pw - 14, y);
      y += 4;
    });

    y += 2;

    // --- Summary & Payment (2 columns) ---
    checkPageBreak(45);

    const summaryBoxX = 14;
    const paymentBoxX = rightColX;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('ORDER SUMMARY', summaryBoxX, y);
    doc.text('PAYMENT DETAILS', paymentBoxX, y);
    y += 5;

    doc.setFontSize(8);
    const summaryRows = [
      ['Subtotal:', formatInr(model.summary.subtotal)],
      ['Discount:', formatInr(model.summary.discount)],
      ['Delivery Charges:', formatInr(model.summary.deliveryCharges)],
      ['Packing Charges:', formatInr(model.summary.packingCharges)],
      ['Tax (GST):', formatInr(model.summary.tax)],
    ];

    let startY = y;
    summaryRows.forEach(([lbl, val]) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(lbl, summaryBoxX, startY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(val, summaryBoxX + colWidth, startY, { align: 'right' });
      startY += 4.5;
    });

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(summaryBoxX, startY, summaryBoxX + colWidth, startY);
    startY += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Grand Total:', summaryBoxX, startY);
    doc.text(formatInr(model.summary.grandTotal), summaryBoxX + colWidth, startY, { align: 'right' });
    startY += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Paid Amount:', summaryBoxX, startY);
    doc.text(formatInr(model.summary.paidAmount), summaryBoxX + colWidth, startY, { align: 'right' });

    // Payment Box details
    let payY = y;
    const paymentRows = [
      ['Method:', model.payment.method],
      ['Cash:', model.payment.isCash ? 'Yes' : 'No'],
      ['Online:', model.payment.isOnline ? 'Yes' : 'No'],
      ['COD:', model.payment.isCod ? 'Yes' : 'No'],
      ['Transaction ID:', model.payment.transactionId || 'N/A'],
      ['Status:', model.payment.status],
    ];

    paymentRows.forEach(([lbl, val]) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(lbl, paymentBoxX, payY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(val), paymentBoxX + colWidth, payY, { align: 'right' });
      payY += 4.5;
    });

    y = Math.max(startY, payY) + 8;

    // --- Shipping Label Section ---
    checkPageBreak(40);

    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(14, y, pw - 14, y);
    doc.setLineDashPattern([], 0); // reset
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('SHIPPING LABEL', 14, y);
    y += 5;

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.rect(14, y, pw - 28, 30);

    let lblY = y + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`SHIP TO: ${model.customer.name}`, 18, lblY);
    doc.text(`ORDER #: ${model.orderNumber}`, pw - 18, lblY, { align: 'right' });
    lblY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(model.customer.addressLine, 18, lblY, { maxWidth: pw - 80 });
    lblY += 4.5;

    const shipLocation = [model.customer.city, model.customer.state, model.customer.pincode].filter((s) => s && s !== '—').join(', ');
    if (shipLocation) {
      doc.text(shipLocation, 18, lblY);
      lblY += 4.5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(`Zone: ${model.parcel.deliveryZone} | Items: ${model.parcel.itemCount} | Mode: ${model.parcel.deliveryMode}`, 18, lblY);
    doc.text(`COD Amount: ${model.payment.isCod ? formatInr(model.payment.codAmount) : 'N/A'}`, pw - 18, lblY, { align: 'right' });

    y += 38;

    // --- Footer Note ---
    checkPageBreak(12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Thank you for choosing ${model.company.appName}! This is a computer-generated tax invoice.`, pw / 2, y, { align: 'center' });

    const filename = `Invoice_${model.orderNumber || model.orderId || 'Order'}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error('PDF export failed:', err);
    // Fallback to print
    window.print();
  }
}
