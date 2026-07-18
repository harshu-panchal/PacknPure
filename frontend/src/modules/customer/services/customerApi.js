import axiosInstance from "@core/api/axios";
import { getWithDedupe, invalidateCache } from "@core/api/dedupe";
import { notificationsApi } from "@core/services/notificationsApi";

export const customerApi = {
  /** Sends OTP; creates account if phone is new */
  sendOtp: (data) => axiosInstance.post("/customer/send-otp", data),
  sendLoginOtp: (data) => axiosInstance.post("/customer/send-otp", data),
  verifyOtp: (data) => axiosInstance.post("/customer/verify-otp", data),
  getProfile: () => getWithDedupe("/customer/profile", {}, { ttl: 5000 }), // Short cache for profile
  updateProfile: (data) => {
    invalidateCache("/customer/profile");
    return axiosInstance.put("/customer/profile", data);
  },
  getWalletTransactions: (params) =>
    getWithDedupe("/customer/transactions", params),
  getCategories: (params) =>
    getWithDedupe("/categories", params, { ttl: 60 * 1000 }), // 1 min for categories
  // Keep a short TTL so admin-side edits (name/description/price) reflect quickly on the app.
  getProducts: (params) => getWithDedupe("/products", params, { ttl: 5000 }),
  getProductById: (id, params) =>
    getWithDedupe(`/products/${id}`, params, { ttl: 5000 }),

  // Sellers & Location
  getNearbySellers: (params) => getWithDedupe("/seller/nearby", params),

  // Cart
  getCart: () => getWithDedupe("/cart", {}, { ttl: 2000 }), // Very short cache for cart
  addToCart: (data) => {
    invalidateCache("/cart"); // Invalidate cart cache
    return axiosInstance.post("/cart/add", data);
  },
  updateCartQuantity: (data) => {
    invalidateCache("/cart");
    return axiosInstance.put("/cart/update", data);
  },
  removeFromCart: (productId, variantId) => {
    invalidateCache("/cart");
    const qs = variantId ? `?variantId=${encodeURIComponent(String(variantId))}` : "";
    return axiosInstance.delete(`/cart/remove/${productId}${qs}`);
  },
  clearCart: () => {
    invalidateCache("/cart");
    return axiosInstance.delete("/cart/clear");
  },

  // Wishlist
  getWishlist: (params) => getWithDedupe("/wishlist", params, { ttl: 5000 }),
  addToWishlist: (data) => {
    invalidateCache("/wishlist");
    return axiosInstance.post("/wishlist/add", data);
  },
  toggleWishlist: (data) => {
    invalidateCache("/wishlist");
    return axiosInstance.post("/wishlist/toggle", data);
  },
  removeFromWishlist: (productId) => {
    invalidateCache("/wishlist");
    return axiosInstance.delete(`/wishlist/remove/${productId}`);
  },

  // Orders
  // Explicit timeout so checkout never waits forever if the server blocks (e.g. Redis/Bull).
  placeOrder: (data) =>
    axiosInstance.post("/orders/place", data, { timeout: 120000 }),
  getMyOrders: () => getWithDedupe("/orders/my-orders"),
  /** No dedupe: order detail must reflect live workflow; cache caused stale/empty client state on refresh. */
  getOrderDetails: (orderId) =>
    axiosInstance.get(
      `/orders/details/${encodeURIComponent(String(orderId ?? "").trim())}`,
    ),
  getDeliveryFee: (lat, lng) =>
    axiosInstance.get("/orders/calculate-delivery-fee", { params: { lat, lng } }),
  // Delivery Mode feature: available modes + enabled slots for the cart page.
  // Short TTL so admin panel changes reflect in the app almost immediately.
  getDeliveryModes: () =>
    getWithDedupe("/delivery-mode/options", {}, { ttl: 15 * 1000 }),
  getOrderRoute: (orderId, params) =>
    axiosInstance.get(`/orders/workflow/${orderId}/route`, { params }),
  cancelOrder: (orderId, data) =>
    axiosInstance.put(`/orders/cancel/${orderId}`, data),
  requestReturn: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/returns`, data),
  getReturnDetails: (orderId) => getWithDedupe(`/orders/${orderId}/returns`),

  // Payments
  createPaymentOrder: (data) => axiosInstance.post("/payments/create-order", data),
  verifyPayment: (data) => axiosInstance.post("/payments/verify", data),

  // Support & Reviews
  getProductReviews: (productId, params) =>
    getWithDedupe(`/reviews/product/${productId}`, params),
  checkUserReview: (productId, params = {}) =>
    getWithDedupe(`/reviews/check/${productId}`, params, { ttl: 0 }),
  submitReview: (formData) => {
    invalidateCache("/reviews");
    invalidateCache("/products");
    return axiosInstance.post("/reviews/submit", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  createTicket: (data) => axiosInstance.post("/tickets/create", data),
  getMyTickets: () => getWithDedupe("/tickets/my-tickets"),

  // Experience sections (home / header pages)
  getExperienceSections: (params) => getWithDedupe("/experience", params),

  // Hero config (separate hero banners + categories per page; fallback to home)
  getHeroConfig: (params) =>
    getWithDedupe("/experience/hero", params, { ttl: 60 * 1000 }),

  // Dynamic Pages
  getDynamicPage: (slug) => getWithDedupe(`/dynamic-pages/public/${slug}`),

  // Public offers
  getOffers: () => getWithDedupe("/offers"),

  // Promotions
  validatePromotion: (data) => axiosInstance.post("/promotions/validate", data),
  getActivePromotions: (params, options) => getWithDedupe("/promotions/available", params, options),

  // Product Requests
  createProductRequest: (data) => axiosInstance.post("/product-requests", data),
  getMyProductRequests: () => getWithDedupe("/product-requests/my-requests"),

  // Notifications
  getNotifications: notificationsApi.getNotifications,
  markNotificationRead: notificationsApi.markNotificationRead,
  markAllNotificationsRead: notificationsApi.markAllNotificationsRead,
  registerDeviceToken: notificationsApi.registerDeviceToken,
  removeDeviceToken: notificationsApi.removeDeviceToken,
  getNotificationPreferences: notificationsApi.getPreferences,
  updateNotificationPreferences: notificationsApi.updatePreferences,
};
