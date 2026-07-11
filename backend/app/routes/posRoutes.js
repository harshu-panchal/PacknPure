import express from "express";
import {
  createTerminal,
  getTerminals,
  startSession,
  endSession,
  getCurrentSession,
  addCashMovement,
  voidBill,
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

// Cash Drawer
router.post("/cash-drawer", addCashMovement);

// Checkout & Void
router.post("/checkout", processPosCheckout);
router.post("/void", voidBill);

export default router;
