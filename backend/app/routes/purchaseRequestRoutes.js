import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  getPurchaseRequests,
  getPurchaseRequestById,
  getPurchaseRequestProductContext,
  createManualPurchaseRequest,
  updatePurchaseRequestStatus,
  assignPickupPartner,
  assignVendor,
  receiveAtHub,
  verifyInward,
  assignReturnPickup,
} from "../controller/purchaseRequestController.js";

const router = express.Router();

router.get("/", verifyToken, allowRoles("admin"), getPurchaseRequests);
router.get(
  "/product-context",
  verifyToken,
  allowRoles("admin"),
  getPurchaseRequestProductContext,
);
router.get("/:id", verifyToken, allowRoles("admin"), getPurchaseRequestById);
router.post("/", verifyToken, allowRoles("admin"), createManualPurchaseRequest);
router.put("/:id/status", verifyToken, allowRoles("admin"), updatePurchaseRequestStatus);
router.put(
  "/:id/assign-vendor",
  verifyToken,
  allowRoles("admin"),
  assignVendor,
);
router.put(
  "/:id/assign-pickup",
  verifyToken,
  allowRoles("admin"),
  assignPickupPartner,
);
router.post("/:id/receive", verifyToken, allowRoles("admin"), receiveAtHub);
router.post("/:id/verify", verifyToken, allowRoles("admin"), verifyInward);
router.post("/:id/assign-return", verifyToken, allowRoles("admin"), assignReturnPickup);

export default router;
