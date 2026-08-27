import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
    getMyReferralSummary,
    getAdminReferrals,
    getAdminReferralStats,
    getAdminReferralUsers,
    updateUserReferralLimit,
    bulkSetReferralLimit,
} from "../controller/referralController.js";

export const customerReferralRouter = express.Router();
customerReferralRouter.get("/me", verifyToken, allowRoles("customer"), getMyReferralSummary);

export const adminReferralRouter = express.Router();
adminReferralRouter.get("/", verifyToken, allowRoles("admin"), getAdminReferrals);
adminReferralRouter.get("/stats", verifyToken, allowRoles("admin"), getAdminReferralStats);
adminReferralRouter.get("/users", verifyToken, allowRoles("admin"), getAdminReferralUsers);
adminReferralRouter.post(
    "/users/limit/bulk",
    verifyToken,
    allowRoles("admin"),
    bulkSetReferralLimit,
);
adminReferralRouter.patch(
    "/users/:id/limit",
    verifyToken,
    allowRoles("admin"),
    updateUserReferralLimit,
);
