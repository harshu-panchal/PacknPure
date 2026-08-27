import express from "express";
import {
    sendCustomerOtp,
    loginCustomer,
    verifyCustomerOTP,
    getCustomerProfile,
    updateCustomerProfile,
    getCustomerTransactions,
} from "../controller/customerAuthController.js";
import {
    getBankDetails,
    updateBankDetails,
    requestWithdrawal,
    getMyWithdrawals,
} from "../controller/customerWalletController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Unified OTP login (auto-creates account if phone is new)
router.post("/send-otp", sendCustomerOtp);
router.post("/send-login-otp", loginCustomer); // legacy alias
router.post("/send-signup-otp", sendCustomerOtp); // legacy — same as send-otp
router.post("/verify-otp", verifyCustomerOTP);

const customerOnly = [verifyToken, allowRoles("customer")];

router.get("/profile", ...customerOnly, getCustomerProfile);
router.put("/profile", ...customerOnly, updateCustomerProfile);
router.get("/transactions", ...customerOnly, getCustomerTransactions);

router.get("/wallet/bank-details", ...customerOnly, getBankDetails);
router.put("/wallet/bank-details", ...customerOnly, updateBankDetails);
router.post("/wallet/withdraw", ...customerOnly, requestWithdrawal);
router.get("/wallet/withdrawals", ...customerOnly, getMyWithdrawals);

export default router;
