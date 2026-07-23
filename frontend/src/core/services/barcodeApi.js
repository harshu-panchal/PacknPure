import axiosInstance from '@core/api/axios';

/**
 * Isolated barcode API helpers (admin + seller).
 * Does not alter existing product/stock endpoints.
 */
async function downloadPdfBlob(productId, params = {}) {
  const response = await axiosInstance.get(`/barcodes/products/${productId}/pdf`, {
    params,
    responseType: 'blob',
  });
  return response.data;
}

function triggerBlobDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function openBlobPrint(blob) {
  const url = window.URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    const revoke = () => window.URL.revokeObjectURL(url);
    printWindow.addEventListener('load', () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // browser may block auto-print; user can print manually
      }
      setTimeout(revoke, 60_000);
    });
  } else {
    // Popup blocked — fall back to download
    triggerBlobDownload(blob, 'barcodes.pdf');
    window.URL.revokeObjectURL(url);
  }
}

export const barcodeApi = {
  list: (productId) =>
    axiosInstance.get(`/barcodes/products/${productId}`),

  ensure: (productId) =>
    axiosInstance.post(`/barcodes/products/${productId}/ensure`),

  downloadPdf: async (productId, { newlyCreatedOnly = false, filename } = {}) => {
    const blob = await downloadPdfBlob(productId, {
      newlyCreatedOnly: newlyCreatedOnly ? 'true' : undefined,
    });
    triggerBlobDownload(
      blob,
      filename || `barcodes_${productId}.pdf`,
    );
    return blob;
  },

  printPdf: async (productId, { newlyCreatedOnly = false } = {}) => {
    const blob = await downloadPdfBlob(productId, {
      newlyCreatedOnly: newlyCreatedOnly ? 'true' : undefined,
    });
    openBlobPrint(blob);
    return blob;
  },

  previewUrl: (barcodeValue) =>
    `/api/barcodes/preview/${encodeURIComponent(barcodeValue)}`,
};
