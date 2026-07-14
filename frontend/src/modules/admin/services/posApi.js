import axiosInstance from '@core/api/axios';

export const posApi = {
    // Terminals
    getTerminals: () => axiosInstance.get('/admin/pos/terminals'),
    createTerminal: (data) => axiosInstance.post('/admin/pos/terminals', data),
    toggleTerminal: (id) => axiosInstance.put(`/admin/pos/terminals/${id}/toggle`),

    // Sessions
    getCurrentSession: () => axiosInstance.get('/admin/pos/sessions/current'),
    openSession: (data) => axiosInstance.post('/admin/pos/sessions/open', data),
    closeSession: (data) => axiosInstance.post('/admin/pos/sessions/close', data),

    // Cash Drawer
    addCashMovement: (data) => axiosInstance.post('/admin/pos/cash-drawer', data),

    // Checkout & Void
    // Note: processCheckout requires an idempotency key which is handled by passing headers
    processCheckout: (data, idempotencyKey) => 
        axiosInstance.post('/admin/pos/checkout', data, {
            headers: { 'x-idempotency-key': idempotencyKey }
        }),
    voidBill: (data) => axiosInstance.post('/admin/pos/void', data),

    // Product Search (New deep POS search)
    searchProducts: (params) => axiosInstance.get('/admin/pos/products/search', { params }),

    // Returns
    returnOrder: (data) => axiosInstance.post('/admin/pos/orders/return', data),

    // Orders
    getOrders: () => axiosInstance.get('/admin/pos/orders'),

    // Dashboard & Reports
    getDashboardStats: () => axiosInstance.get('/admin/pos/dashboard'),
    getPosReports: (params) => axiosInstance.get('/admin/pos/reports', { params }),

    // Customer
    searchCustomer: (phone) => axiosInstance.get('/admin/pos/customers/search', { params: { phone } }),

    // Cart Calculation
    calculateCartTotals: (data) => axiosInstance.post('/admin/pos/checkout/calculate', data),

    // Payment Config & Creation
    getPaymentConfig: () => axiosInstance.get('/admin/pos/payment/config'),
    createRazorpayOrder: (data) => axiosInstance.post('/admin/pos/payment/create-order', data),

    // Receipt
    shareReceipt: (data) => axiosInstance.post('/admin/pos/receipt/share', data),
};
