import axiosInstance from "@core/api/axios";

export const pickupApi = {
  sendLoginOtp: (data) => axiosInstance.post("/pickup-partner/send-login-otp", data),
  verifyOtp: (data) => axiosInstance.post("/pickup-partner/verify-otp", data),
  getMyProfile: () => axiosInstance.get("/pickup-partner/my/profile"),
  updateProfile: (data) => axiosInstance.put("/pickup-partner/my/profile", data),
  getAssignments: (params) =>
    axiosInstance.get("/pickup-partner/my/assignments", { params }),
  markReachedSeller: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/reached-seller`, data),
  generatePickupOtp: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/generate-otp`, data),
  verifyPickupOtp: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/verify-pickup-otp`, data),
  updateLiveLocation: (data) =>
    axiosInstance.post("/pickup-partner/my/location", data),
  markPicked: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/mark-picked`, data),
  markHubDelivered: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/mark-hub-delivered`, data),
  cancelPickupAssignment: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/cancel`, data),
  markReturnDelivered: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/mark-return-delivered`, data),
  uploadProofImage: (formData, type = "vendor", onUploadProgress) =>
    axiosInstance.post(`/pickup-partner/my/proofs/upload?type=${type}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    }),
  requestWithdrawal: (data) => axiosInstance.post("/pickup-partner/my/withdrawals", data),
  getWithdrawals: () => axiosInstance.get("/pickup-partner/my/withdrawals"),
};
