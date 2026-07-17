import express from "express";
import {
  createTerminal,
  getTerminals,
  toggleTerminalStatus,
  deleteTerminal,
  startSession,
  endSession,
  getCurrentSession,
  getAllSessions,
  addCashMovement,
  voidBill,
  getPosDashboardStats,
  getPosReports,
  searchPosProducts,
  returnPosOrder,
  getPosOrders,
  searchCustomer,
  calculateCartTotals,
  getPaymentConfig,
  sharePosReceipt
} from "../controller/posController.js";
import { processPosCheckout, createPosPaymentOrder } from "../controller/posCheckoutController.js";
import { verifyToken, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All POS routes should be protected for admins/cashiers
router.use(verifyToken, requireAdmin);

// Terminals
router.post("/terminals", createTerminal);
router.get("/terminals", getTerminals);
router.put("/terminals/:id/toggle", toggleTerminalStatus);
router.delete("/terminals/:id", deleteTerminal);

// Sessions
router.post("/sessions/open", startSession);
router.post("/sessions/close", endSession);
router.get("/sessions/current", getCurrentSession);
router.get("/sessions", getAllSessions);

// Dashboard & Search
router.get("/dashboard", getPosDashboardStats);
router.get("/reports", getPosReports);
router.get("/products/search", searchPosProducts);

// Cash Drawer
router.post("/cash-drawer", addCashMovement);

// Checkout & Void & Returns
router.post("/checkout", processPosCheckout);
router.post("/checkout/calculate", calculateCartTotals);
router.post("/void", voidBill);
router.post("/orders/return", returnPosOrder);
router.get("/orders", getPosOrders);

// Customers
router.get("/customers/search", searchCustomer);

// Payment
router.get("/payment/config", getPaymentConfig);
router.post("/payment/create-order", createPosPaymentOrder);

// Receipt
router.post("/receipt/share", sharePosReceipt);

export default router;
