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
    triggerBlobDownload(blob, 'barcodes.pdf');
    window.URL.revokeObjectURL(url);
  }
}

async function blobFromErrorResponse(error) {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      return parsed?.message || 'Request failed';
    } catch {
      return 'Request failed';
    }
  }
  return error?.response?.data?.message || error?.message || 'Request failed';
}

export const barcodeApi = {
  catalog: (params) =>
    axiosInstance.get('/barcodes/catalog', { params }),

  catalogBrands: () =>
    axiosInstance.get('/barcodes/catalog/brands'),

  list: (productId) =>
    axiosInstance.get(`/barcodes/products/${productId}`),

  ensure: (productId) =>
    axiosInstance.post(`/barcodes/products/${productId}/ensure`),

  ensureMissing: (data = {}) =>
    axiosInstance.post('/barcodes/ensure-missing', data),

  downloadPdf: async (
    productId,
    { newlyCreatedOnly = false, variantIds, filename } = {},
  ) => {
    try {
      const blob = await downloadPdfBlob(productId, {
        newlyCreatedOnly: newlyCreatedOnly ? 'true' : undefined,
        variantIds: Array.isArray(variantIds) ? variantIds.join(',') : variantIds,
      });
      triggerBlobDownload(blob, filename || `barcodes_${productId}.pdf`);
      return blob;
    } catch (error) {
      throw new Error(await blobFromErrorResponse(error));
    }
  },

  printPdf: async (
    productId,
    { newlyCreatedOnly = false, variantIds } = {},
  ) => {
    try {
      const blob = await downloadPdfBlob(productId, {
        newlyCreatedOnly: newlyCreatedOnly ? 'true' : undefined,
        variantIds: Array.isArray(variantIds) ? variantIds.join(',') : variantIds,
      });
      openBlobPrint(blob);
      return blob;
    } catch (error) {
      throw new Error(await blobFromErrorResponse(error));
    }
  },

  /** Authenticated PNG preview (blob URL). Caller must revokeObjectURL. */
  fetchPreviewBlobUrl: async (barcodeValue) => {
    const response = await axiosInstance.get(
      `/barcodes/preview/${encodeURIComponent(barcodeValue)}`,
      { responseType: 'blob' },
    );
    return window.URL.createObjectURL(response.data);
  },

  previewUrl: (barcodeValue) =>
    `/api/barcodes/preview/${encodeURIComponent(barcodeValue)}`,
};
