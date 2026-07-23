import bwipjs from "bwip-js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Render a Code128 barcode PNG buffer for the given value.
 */
export async function renderCode128Png(barcodeValue, opts = {}) {
  const value = String(barcodeValue || "").trim();
  if (!value) {
    throw new Error("Barcode value is required");
  }

  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text: value,
    scale: opts.scale || 3,
    height: opts.height || 12,
    includetext: true,
    textxalign: "center",
    textsize: opts.textsize || 10,
  });

  return png;
}

/**
 * Build a printable PDF with one label block per variant barcode.
 *
 * Layout per label:
 *   Product name
 *   Variant name
 *   [Code128 barcode]
 *   ---------------
 *
 * @param {Array<{ productName: string, variantName: string, barcodeValue: string }>} labels
 * @returns {Promise<Uint8Array>}
 */
export async function buildBarcodeLabelsPdf(labels = []) {
  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error("No barcodes available to print");
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 288; // 4 inch
  const pageHeight = 432; // 6 inch
  const marginX = 24;
  const marginTop = 28;
  const labelGap = 18;
  const barcodeMaxWidth = pageWidth - marginX * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - marginTop;

  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const productName = String(label.productName || "Product").slice(0, 60);
    const variantName = String(label.variantName || "Variant").slice(0, 60);
    const barcodeValue = String(label.barcodeValue || "").trim();

    if (!barcodeValue) continue;

    const pngBytes = await renderCode128Png(barcodeValue);
    const pngImage = await pdfDoc.embedPng(pngBytes);

    const scale = Math.min(1, barcodeMaxWidth / pngImage.width);
    const drawWidth = pngImage.width * scale;
    const drawHeight = pngImage.height * scale;

    const blockHeight = 18 + 14 + drawHeight + 16 + labelGap;

    if (cursorY - blockHeight < 24) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - marginTop;
    }

    page.drawText(productName, {
      x: marginX,
      y: cursorY - 12,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawText(variantName, {
      x: marginX,
      y: cursorY - 28,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    const barcodeY = cursorY - 28 - 8 - drawHeight;
    page.drawImage(pngImage, {
      x: marginX + (barcodeMaxWidth - drawWidth) / 2,
      y: barcodeY,
      width: drawWidth,
      height: drawHeight,
    });

    const dividerY = barcodeY - 10;
    page.drawLine({
      start: { x: marginX, y: dividerY },
      end: { x: pageWidth - marginX, y: dividerY },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });

    cursorY = dividerY - labelGap;
  }

  return pdfDoc.save();
}
