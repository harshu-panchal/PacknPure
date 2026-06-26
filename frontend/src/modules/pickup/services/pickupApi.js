import axiosInstance from "@core/api/axios";

export const pickupApi = {
  sendLoginOtp: (data) => axiosInstance.post("/pickup-partner/send-login-otp", data),
  verifyOtp: (data) => axiosInstance.post("/pickup-partner/verify-otp", data),
  getMyProfile: () => axiosInstance.get("/pickup-partner/my/profile"),
  updateProfile: (data) => axiosInstance.put("/pickup-partner/my/profile", data),
  getAssignments: (params) =>
    axiosInstance.get("/pickup-partner/my/assignments", { params }),
  markPicked: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/mark-picked`, data),
  markHubDelivered: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/mark-hub-delivered`, data),
  cancelPickupAssignment: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/cancel`, data),
  markReturnDelivered: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/mark-return-delivered`, data),
  uploadProofImage: (formData, type = "vendor") =>
    axiosInstance.post(`/pickup-partner/my/proofs/upload?type=${type}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  requestWithdrawal: (data) => axiosInstance.post("/pickup-partner/my/withdrawals", data),
  getWithdrawals: () => axiosInstance.get("/pickup-partner/my/withdrawals"),
};
