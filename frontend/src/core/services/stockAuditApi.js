import axiosInstance from '@core/api/axios';

export const stockAuditApi = {
  list: (params) => axiosInstance.get('/stock-audits', { params }),
  create: (data) => axiosInstance.post('/stock-audits', data),
  get: (id) => axiosInstance.get(`/stock-audits/${id}`),
  start: (id) => axiosInstance.post(`/stock-audits/${id}/start`),
  pause: (id) => axiosInstance.post(`/stock-audits/${id}/pause`),
  resume: (id) => axiosInstance.post(`/stock-audits/${id}/resume`),
  complete: (id) => axiosInstance.post(`/stock-audits/${id}/complete`),
  cancel: (id) => axiosInstance.post(`/stock-audits/${id}/cancel`),
  scan: (id, barcode) =>
    axiosInstance.post(`/stock-audits/${id}/scan`, { barcode }),
  report: (id) => axiosInstance.get(`/stock-audits/${id}/report`),
  exportCsvUrl: (id) => `/api/stock-audits/${id}/export.csv`,
  downloadCsv: async (id, filename) => {
    const res = await axiosInstance.get(`/stock-audits/${id}/export.csv`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `stock_audit_${id}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
