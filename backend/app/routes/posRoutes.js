import express from "express";
import {
  createTerminal,
  getTerminals,
  startSession,
  endSession,
  getCurrentSession,
  addCashMovement,
  voidBill,
  getPosDashboardStats,
  searchPosProducts,
  returnPosOrder,
  getPosOrders
} from "../controller/posController.js";
import { processPosCheckout } from "../controller/posCheckoutController.js";
import { verifyToken, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All POS routes should be protected for admins/cashiers
router.use(verifyToken, requireAdmin);

// Terminals
router.post("/terminals", createTerminal);
router.get("/terminals", getTerminals);

// Sessions
router.post("/sessions/open", startSession);
router.post("/sessions/close", endSession);
router.get("/sessions/current", getCurrentSession);

// Dashboard & Search
router.get("/dashboard", getPosDashboardStats);
router.get("/products/search", searchPosProducts);

// Cash Drawer
router.post("/cash-drawer", addCashMovement);

// Checkout & Void & Returns
router.post("/checkout", processPosCheckout);
router.post("/void", voidBill);
router.post("/orders/return", returnPosOrder);
router.get("/orders", getPosOrders);

export default router;
