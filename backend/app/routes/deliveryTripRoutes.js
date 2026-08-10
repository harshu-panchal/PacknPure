import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  getEligibleOrdersForTrip,
  createDeliveryTrip,
} from "../controller/deliveryTripController.js";

const router = express.Router();

router.get(
  "/eligible-orders",
  verifyToken,
  allowRoles("admin"),
  getEligibleOrdersForTrip,
);
router.post("/", verifyToken, allowRoles("admin"), createDeliveryTrip);

export default router;
