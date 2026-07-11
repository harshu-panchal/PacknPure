import axiosInstance from '@core/api/axios';

export const posApi = {
    // Terminals
    getTerminals: () => axiosInstance.get('/admin/pos/terminals'),
    createTerminal: (data) => axiosInstance.post('/admin/pos/terminals', data),

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

    // Dashboard
    getDashboardStats: () => axiosInstance.get('/admin/pos/dashboard'),
};
