import DynamicPage from "../models/dynamicPage.js";
import handleResponse from "../utils/helper.js";

// ADMIN: Get all dynamic pages
export const getAdminDynamicPages = async (req, res) => {
  try {
    const pages = await DynamicPage.find().sort({ createdAt: -1 }).lean();
    return handleResponse(res, 200, "Dynamic pages fetched successfully", pages);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ADMIN: Get dynamic page by slug
export const getAdminDynamicPage = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = await DynamicPage.findOne({ slug }).lean();
    if (!page) return handleResponse(res, 404, "Page not found");
    return handleResponse(res, 200, "Page fetched successfully", page);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ADMIN: Upsert dynamic page
export const upsertDynamicPage = async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, content, metaTitle, metaDescription, status } = req.body;

    if (!title || !title.trim()) {
      return handleResponse(res, 400, "Title is required");
    }

    const payload = {
      title,
      content,
      metaTitle,
      metaDescription,
      status: status || "active",
    };

    const page = await DynamicPage.findOneAndUpdate(
      { slug },
      { $set: payload },
      { new: true, upsert: true, runValidators: true }
    );

    return handleResponse(res, 200, "Page saved successfully", page);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ADMIN: Delete dynamic page
export const deleteDynamicPage = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = await DynamicPage.findOneAndDelete({ slug });
    if (!page) return handleResponse(res, 404, "Page not found");
    return handleResponse(res, 200, "Page deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// PUBLIC: Get active dynamic page by slug
export const getPublicDynamicPage = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = await DynamicPage.findOne({ slug, status: "active" }).lean();
    if (!page) return handleResponse(res, 404, "Page not found or inactive");
    return handleResponse(res, 200, "Page fetched successfully", page);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
