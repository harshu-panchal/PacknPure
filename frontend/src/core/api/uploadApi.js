import axiosInstance from "./axios";

/**
 * Reusable Cloudinary upload helpers (requires auth token).
 * @see POST /api/upload/single | /api/upload/multiple
 */
export const uploadApi = {
  listFolders: () => axiosInstance.get("/upload/folders"),

  /**
   * @param {File|Blob} file
   * @param {string} folder - e.g. "products", "customers/avatars"
   */
  uploadSingle: (file, folder = "misc") => {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    return axiosInstance.post("/upload/single", form, {
      timeout: 120000,
    });
  },

  /**
   * @param {File[]} files
   * @param {string} folder
   */
  uploadMultiple: (files, folder = "misc") => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("folder", folder);
    return axiosInstance.post("/upload/multiple", form, {
      timeout: 180000,
    });
  },
};

/** Extract uploaded media from API response */
export const getUploadResult = (response) =>
  response?.data?.result ?? response?.data?.data ?? null;

export const getMultipleUploadResults = (response) => {
  const result = getUploadResult(response);
  return result?.uploads ?? [];
};
