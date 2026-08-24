import express from "express";
import {
    listPromotions,
    createPromotion,
    getPromotion,
    updatePromotion,
    updateStatus,
    deletePromotion,
    getAnalytics,
    getAvailablePromotions,
    validatePromotion
} from "../controller/promotionController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

const adminOnly = [verifyToken, allowRoles("admin")];

// Admin Routes
router.get("/admin/promotions", ...adminOnly, listPromotions);
router.post("/admin/promotions", ...adminOnly, createPromotion);
router.get("/admin/promotions/:id", ...adminOnly, getPromotion);
router.put("/admin/promotions/:id", ...adminOnly, updatePromotion);
router.patch("/admin/promotions/:id/status", ...adminOnly, updateStatus);
router.delete("/admin/promotions/:id", ...adminOnly, deletePromotion);
router.get("/admin/promotions/:id/analytics", ...adminOnly, getAnalytics);

// Customer Routes
router.get("/promotions/available", getAvailablePromotions);
router.post("/promotions/validate", validatePromotion);

export default router;
