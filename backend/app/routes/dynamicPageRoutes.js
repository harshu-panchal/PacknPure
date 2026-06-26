import express from "express";
import {
  getAdminDynamicPages,
  getAdminDynamicPage,
  upsertDynamicPage,
  deleteDynamicPage,
  getPublicDynamicPage,
} from "../controller/dynamicPageController.js";
import { verifyToken, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// PUBLIC
router.get("/public/:slug", getPublicDynamicPage);

// ADMIN
router.use("/admin", verifyToken, requireAdmin);
router.get("/admin", getAdminDynamicPages);
router.get("/admin/:slug", getAdminDynamicPage);
router.put("/admin/:slug", upsertDynamicPage);
router.delete("/admin/:slug", deleteDynamicPage);

export default router;
