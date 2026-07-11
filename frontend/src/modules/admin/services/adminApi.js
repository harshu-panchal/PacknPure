import axiosInstance from '@core/api/axios';
import { notificationsApi } from '@core/services/notificationsApi';

export const adminApi = {
    login: (data) => axiosInstance.post('/admin/login', data),
    forgotPasswordOtp: (data) => axiosInstance.post('/admin/forgot-password', data),
    resetPasswordWithOtp: (data) => axiosInstance.post('/admin/reset-password', data),
    signup: (data) => axiosInstance.post('/admin/signup', data),
    
    // Notifications
    getNotifications: notificationsApi.getNotifications,
    markNotificationRead: notificationsApi.markNotificationRead,
    markAllNotificationsRead: notificationsApi.markAllNotificationsRead,
    registerDeviceToken: notificationsApi.registerDeviceToken,
    removeDeviceToken: notificationsApi.removeDeviceToken,
    getNotificationPreferences: notificationsApi.getPreferences,
    updateNotificationPreferences: notificationsApi.updatePreferences,
    getBroadcastHistory: notificationsApi.getBroadcastHistory,
    broadcastNotification: notificationsApi.broadcast,

    getStats: () => axiosInstance.get('/admin/stats'),
    getUsers: (params) => axiosInstance.get('/admin/users', { params }),
    getUserById: (id) => axiosInstance.get(`/admin/users/${id}`),
    getCodCustomers: (params) => axiosInstance.get('/admin/users-cod', { params }),
    updateUserCodPolicy: (id, data) => axiosInstance.patch(`/admin/users/${id}/cod-policy`, data),
    updateUserStatus: (id, data) => axiosInstance.patch(`/admin/users/${id}/status`, data),
    approveSeller: (id) => axiosInstance.patch(`/admin/sellers/approve/${id}`),
    rejectSeller: (id) => axiosInstance.delete(`/admin/sellers/reject/${id}`),
    getAdminWalletData: (params) => axiosInstance.get('/admin/wallet-data', { params }),
    getReports: (params) => axiosInstance.get('/admin/reports', { params }),
    exportGstReport: (params) => axiosInstance.get('/admin/reports/gst-export', { params, responseType: 'blob' }),
    exportVendorPayouts: () => axiosInstance.get('/admin/reports/vendor-payouts-export', { responseType: 'blob' }),
    exportInventory: () => axiosInstance.get('/admin/reports/inventory-export', { responseType: 'blob' }),
    getProfile: () => axiosInstance.get('/admin/profile'),
    updateProfile: (data) => axiosInstance.put('/admin/profile', data),
    updatePassword: (data) => axiosInstance.put('/admin/profile/password', data),
    getPlatformSettings: () => axiosInstance.get('/admin/settings/platform'),
    updatePlatformSettings: (data) => axiosInstance.put('/admin/settings/platform', data),
    getSettings: () => axiosInstance.get('/settings'),
    updateSettings: (data) => axiosInstance.put('/settings', data),
    uploadSettingsImage: (formData, type = 'logo') =>
        axiosInstance.post(`/settings/upload?type=${type}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

    // Category Management
    getCategories: (params) => axiosInstance.get('/admin/categories', { params }),
    getCategoryTree: () => axiosInstance.get('/admin/categories?tree=true'),
    getSellers: (params) => axiosInstance.get('/admin/sellers', { params }),
    getSellerById: (id) => axiosInstance.get(`/admin/sellers/${id}`),
    createSeller: (data) => axiosInstance.post('/admin/sellers', data),
    updateSeller: (id, data) => axiosInstance.put(`/admin/sellers/${id}`, data),
    createCategory: (formData) => axiosInstance.post('/admin/categories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    updateCategory: (id, formData) => axiosInstance.put(`/admin/categories/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    deleteCategory: (id) => axiosInstance.delete(`/admin/categories/${id}`),
    getParentUnits: () => axiosInstance.get('/admin/categories?flat=true'),

    // Product Management
    getProducts: (params) => axiosInstance.get('/products/admin/list', { params }),
    createProduct: (formData) => axiosInstance.post('/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    updateProduct: (id, formData) => axiosInstance.put(`/products/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    updateVariantStock: (id, data) => axiosInstance.patch(`/products/${id}/variant-stock`, data),
    deleteProduct: (id) => axiosInstance.delete(`/products/${id}`),
    getProductGoLivePreview: (id) => axiosInstance.get(`/products/${id}/go-live-preview`),
    publishProductGoLive: (id, data) => axiosInstance.post(`/products/${id}/go-live`, data),
    getHubInventory: (params) => axiosInstance.get('/admin/hub-inventory', { params }),
    upsertHubInventory: (data) => axiosInstance.post('/admin/hub-inventory/upsert', data),
    adjustHubInventoryStock: (id, payload) =>
        axiosInstance.post(`/admin/hub-inventory/${id}/adjust-stock`, payload),
    updateHubInventoryReorderLevel: (id, reorderLevel) =>
        axiosInstance.put(`/admin/hub-inventory/${id}/reorder-level`, { reorderLevel }),
    deleteHubInventory: (id) => axiosInstance.delete(`/admin/hub-inventory/${id}`),
    getPurchaseRequests: (params) => axiosInstance.get('/admin/purchase-requests', { params }),
    getPurchaseRequestById: (id) => axiosInstance.get(`/admin/purchase-requests/${id}`),
    getPurchaseRequestProductContext: (productId, variantId) =>
        axiosInstance.get('/admin/purchase-requests/product-context', {
            params: {
                productId,
                ...(variantId ? { variantId } : {}),
            },
        }),
    createManualPurchaseRequest: (data) =>
        axiosInstance.post('/admin/purchase-requests', data),
    updatePurchaseRequestStatus: (id, status, payload = {}) =>
        axiosInstance.put(`/admin/purchase-requests/${id}/status`, { status, ...payload }),
    assignPurchasePickupPartner: (id, data) =>
        axiosInstance.put(`/admin/purchase-requests/${id}/assign-pickup`, data),
    assignReturnPickup: (id, data) =>
        axiosInstance.post(`/admin/purchase-requests/${id}/assign-return`, data),
    assignPurchaseVendor: (id, data) =>
        axiosInstance.put(`/admin/purchase-requests/${id}/assign-vendor`, data),
    receivePurchaseRequestAtHub: (id, data = {}) =>
        axiosInstance.post(`/admin/purchase-requests/${id}/receive`, data),
    verifyPurchaseRequestInward: (id, data = {}) =>
        axiosInstance.post(`/admin/purchase-requests/${id}/verify`, data),
    getPickupPartners: (params) => axiosInstance.get('/admin/pickup-partners', { params }),
    createPickupPartner: (data) => axiosInstance.post('/admin/pickup-partners', data),
    updatePickupPartner: (id, data) => axiosInstance.put(`/admin/pickup-partners/${id}`, data),
    updatePickupPartnerStatus: (id, status) =>
        axiosInstance.patch(`/admin/pickup-partners/${id}/status`, { status }),
    getOrders: (params) => axiosInstance.get('/orders/seller-orders', { params }),
    getOrderDetails: (orderId) => axiosInstance.get(`/orders/details/${orderId}`),
    updateOrderStatus: (orderId, data) => axiosInstance.put(`/orders/status/${orderId}`, data),

    // Support Tickets
    getTickets: (params) => axiosInstance.get('/tickets/admin/all', { params }),
    updateTicketStatus: (id, status) => axiosInstance.patch(`/tickets/admin/status/${id}`, { status }),
    replyTicket: (id, text) => axiosInstance.post(`/tickets/reply/${id}`, { text, isAdmin: true }),

    // Reviews
    getPendingReviews: (params) => axiosInstance.get('/reviews/admin/pending', { params }),
    updateReviewStatus: (id, status) => axiosInstance.patch(`/reviews/admin/status/${id}`, { status }),

    // Delivery Partners
    getDeliveryPartners: (params) => axiosInstance.get('/admin/delivery-partners', { params }),
    getDeliveryPartnerById: (id) => axiosInstance.get(`/admin/delivery-partners/${id}`),
    approveDeliveryPartner: (id) => axiosInstance.patch(`/admin/delivery-partners/approve/${id}`),
    rejectDeliveryPartner: (id) => axiosInstance.delete(`/admin/delivery-partners/reject/${id}`),
    getActiveFleet: (params) => axiosInstance.get('/admin/active-fleet', { params }),

    // Delivery Payouts / Funds
    getDeliveryTransactions: (params) => axiosInstance.get('/admin/delivery-transactions', { params }),
    settleTransaction: (id) => axiosInstance.put(`/admin/transactions/${id}/settle`),
    bulkSettleDelivery: () => axiosInstance.put('/admin/transactions/bulk-settle-delivery'),

    // Seller Withdrawals
    getSellerWithdrawals: (params) => axiosInstance.get('/admin/seller-withdrawals', { params }),
    getDeliveryWithdrawals: (params) => axiosInstance.get('/admin/delivery-withdrawals', { params }),
    getPickupWithdrawals: (params) => axiosInstance.get('/admin/pickup-withdrawals', { params }),
    getSellerTransactions: (params) => axiosInstance.get('/admin/seller-transactions', { params }),
    updateWithdrawalStatus: (id, data) => axiosInstance.put(`/admin/withdrawals/${id}`, data),
    settlePickupWallet: (data) => axiosInstance.post('/admin/settle-pickup-wallet', data),
    // Cash Collection Hub
    getDeliveryCashBalances: (params) => axiosInstance.get('/admin/delivery-cash', { params }),
    getRiderCashDetails: (id) => axiosInstance.get(`/admin/rider-cash-details/${id}`),
    settleRiderCash: (data) => axiosInstance.post('/admin/settle-cash', data),
    getCashSettlementHistory: (params) => axiosInstance.get('/admin/cash-history', { params }),

    // FAQ Management
    getFAQs: (params) => axiosInstance.get('/admin/faqs', { params }),
    createFAQ: (data) => axiosInstance.post('/admin/faqs', data),
    updateFAQ: (id, data) => axiosInstance.put(`/admin/faqs/${id}`, data),
    deleteFAQ: (id) => axiosInstance.delete(`/admin/faqs/${id}`),
    // Public FAQs (for profile pages, etc.)
    getPublicFAQs: (params) => axiosInstance.get('/public/faqs', { params }),

    // Experience Studio / Content Manager
    getExperienceSections: (params) => axiosInstance.get('/admin/experience', { params }),
    createExperienceSection: (data) => axiosInstance.post('/admin/experience', data),
    updateExperienceSection: (id, data) => axiosInstance.put(`/admin/experience/${id}`, data),
    deleteExperienceSection: (id) => axiosInstance.delete(`/admin/experience/${id}`),
    reorderExperienceSections: (items) => axiosInstance.put('/admin/experience/reorder', { items }),
    uploadExperienceBanner: (formData) => axiosInstance.post('/admin/experience/upload-banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),

    // Hero config (separate hero banners + categories per page)
    getHeroConfig: (params) => axiosInstance.get('/admin/experience/hero', { params }),
    setHeroConfig: (data) => axiosInstance.put('/admin/experience/hero', data),

    // Dynamic Pages
    getDynamicPages: () => axiosInstance.get('/dynamic-pages/admin'),
    getDynamicPage: (slug) => axiosInstance.get(`/dynamic-pages/admin/${slug}`),
    upsertDynamicPage: (slug, data) => axiosInstance.put(`/dynamic-pages/admin/${slug}`, data),
    deleteDynamicPage: (slug) => axiosInstance.delete(`/dynamic-pages/admin/${slug}`),

    // Offers Management
    getOffers: (params) => axiosInstance.get('/admin-offers', { params }),
    createOffer: (data) => axiosInstance.post('/admin-offers', data),
    updateOffer: (id, data) => axiosInstance.put(`/admin-offers/${id}`, data),
    deleteOffer: (id) => axiosInstance.delete(`/admin-offers/${id}`),
    reorderOffers: (items) => axiosInstance.put('/admin-offers/reorder', { items }),



    // Coupons & Promos
    getCoupons: (params) => axiosInstance.get('/admin/promotions', { params }),
    createCoupon: (data) => axiosInstance.post('/admin/promotions', data),
    updateCoupon: (id, data) => axiosInstance.put(`/admin/promotions/${id}`, data),
    deleteCoupon: (id) => axiosInstance.delete(`/admin/promotions/${id}`),

    // Product Requests
    getProductRequests: (params) => axiosInstance.get('/product-requests', { params }),
    updateProductRequestStatus: (id, status) => axiosInstance.put(`/product-requests/${id}/status`, { status }),
};
