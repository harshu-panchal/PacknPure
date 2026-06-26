import express from "express";
import multer from "multer";
import {
    submitReview,
    getProductReviews,
    checkUserReview,
    getPendingReviews,
    updateReviewStatus,
} from "../controller/reviewController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Multer: in-memory storage, max 4 images, max 5MB each
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only image files are allowed"), false);
    },
});

// Public routes
router.get("/product/:productId", getProductReviews);

// Authenticated User routes
router.get("/check/:productId", verifyToken, checkUserReview);
router.post("/submit", verifyToken, upload.array("images", 4), submitReview);

// Admin only routes
router.get("/admin/pending", verifyToken, allowRoles("admin"), getPendingReviews);
router.patch("/admin/status/:id", verifyToken, allowRoles("admin"), updateReviewStatus);

export default router;
