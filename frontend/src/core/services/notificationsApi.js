import axiosInstance from "@core/api/axios";

export const notificationsApi = {
  getNotifications: (params) => axiosInstance.get("/notifications", { params }),
  markNotificationRead: (id) => axiosInstance.put(`/notifications/${id}/read`),
  markAllNotificationsRead: () => axiosInstance.put("/notifications/mark-all-read"),
  registerDeviceToken: (data) => axiosInstance.post("/notifications/device/register", data),
  removeDeviceToken: (data) => axiosInstance.delete("/notifications/device", { data }),
  getPreferences: () => axiosInstance.get("/notifications/preferences"),
  updatePreferences: (data) => axiosInstance.put("/notifications/preferences", data),
  getBroadcastHistory: (params) => axiosInstance.get("/notifications/broadcasts", { params }),
  broadcast: (data) => axiosInstance.post("/notifications/broadcast", data),
};

