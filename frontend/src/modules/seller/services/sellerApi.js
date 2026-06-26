import axiosInstance from '@core/api/axios';

export const sellerApi = {
    login: (data) => axiosInstance.post('/seller/login', data),
    forgotPasswordOtp: (data) => axiosInstance.post('/seller/forgot-password', data),
    resetPasswordWithOtp: (data) => axiosInstance.post('/seller/reset-password', data),
    signup: (data) => axiosInstance.post('/seller/signup', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    // Products
    getProducts: (params) => axiosInstance.get('/products/seller/me', { params }),
    getMasterCatalog: (params) =>
        axiosInstance.get('/products', {
            params: { ownerType: 'admin', status: 'active', limit: 100, ...params },
        }),
    getProductById: (id) => axiosInstance.get(`/products/${id}`),
    createProduct: (data) => axiosInstance.post('/products', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    updateProduct: (id, data) => axiosInstance.put(`/products/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    deleteProduct: (id) => axiosInstance.delete(`/products/${id}`),

    // Categories (Public)
    getCategories: () => axiosInstance.get('/admin/categories'),
    getCategoryTree: () => axiosInstance.get('/admin/categories?tree=true'),

    // Others
    getStats: (range) => axiosInstance.get('/seller/stats', { params: { range } }),
    getEarnings: () => axiosInstance.get('/seller/earnings'),
    getProfile: () => axiosInstance.get('/seller/profile'),
    updateProfile: (data) => axiosInstance.put('/seller/profile', data),
    updatePassword: (data) => axiosInstance.put('/seller/profile/password', data),
    reverseGeocode: (lat, lng) =>
        axiosInstance.get('/seller/location/reverse-geocode', { params: { lat, lng } }),
    geocodeAddress: (address) =>
        axiosInstance.post('/seller/location/geocode-address', { address }),

    // Stock
    adjustStock: (data) => axiosInstance.post('/products/adjust-stock', data),
    updateVariantStock: (id, data) => axiosInstance.patch(`/products/${id}/variant-stock`, data),
    getStockHistory: () => axiosInstance.get('/products/stock-history'),

    // Notifications
    getNotifications: () => axiosInstance.get('/notifications'),
    markNotificationRead: (id) => axiosInstance.put(`/notifications/${id}/read`),
    markAllNotificationsRead: () => axiosInstance.put('/notifications/mark-all-read'),

    // Money Requests
    requestWithdrawal: (data) => axiosInstance.post('/seller/request-withdrawal', data),

    // Returns
    getReturns: (params) => axiosInstance.get('/orders/seller-returns', { params }),
    getReturnDetails: (orderId) => axiosInstance.get(`/orders/${orderId}/returns`),
    approveReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/approve`, data),
    rejectReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/reject`, data),
    assignReturnDelivery: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/assign-delivery`, data),

    // Procurement requests (seller-side SOP flow)
    getPurchaseRequests: (params) => axiosInstance.get('/seller/purchase-requests', { params }),
    getPurchaseRequestById: (id) => axiosInstance.get(`/seller/purchase-requests/${id}`),
    respondPurchaseRequest: (id, data) => axiosInstance.post(`/seller/purchase-requests/${id}/respond`, data),
    markPurchaseRequestReady: (id, data) => axiosInstance.post(`/seller/purchase-requests/${id}/ready`, data),
    confirmPurchaseHandover: (id, data) => axiosInstance.post(`/seller/purchase-requests/${id}/handover`, data),
    confirmPurchaseReturn: (id, data = {}) => axiosInstance.post(`/seller/purchase-requests/${id}/confirm-return`, data),
    getSettings: () => axiosInstance.get('/settings'),
};
