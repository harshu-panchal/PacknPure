import express from "express";
import {
    createRazorpayOrder,
    verifyPayment,
    createWalletTopupOrder,
    verifyWalletTopup,
} from "../controller/paymentController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

const customerOnly = [verifyToken, allowRoles("customer")];
router.post("/create-order", ...customerOnly, createRazorpayOrder);
router.post("/verify", ...customerOnly, verifyPayment);
router.post("/wallet-topup/create-order", ...customerOnly, createWalletTopupOrder);
router.post("/wallet-topup/verify", ...customerOnly, verifyWalletTopup);

export default router;
