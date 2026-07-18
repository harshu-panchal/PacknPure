import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  getDeliverySettings,
  updateDeliverySettings,
  getSlots,
  createSlot,
  updateSlot,
  deleteSlot,
  toggleSlot,
  reorderSlots,
  getAvailableDeliveryModes,
} from "../controller/deliveryModeController.js";

const router = express.Router();

const adminOnly = [verifyToken, allowRoles("admin")];

/* ---------- User (public) ---------- */
// Available delivery modes for the cart page (express + enabled slots)
router.get("/options", getAvailableDeliveryModes);

/* ---------- Admin — Delivery Settings ---------- */
router.get("/admin/settings", ...adminOnly, getDeliverySettings);
router.put("/admin/settings", ...adminOnly, updateDeliverySettings);

/* ---------- Admin — Slot Management ---------- */
router.get("/admin/slots", ...adminOnly, getSlots);
router.post("/admin/slots", ...adminOnly, createSlot);
// NOTE: "/admin/slots/reorder" must be registered before "/admin/slots/:id"
router.put("/admin/slots/reorder", ...adminOnly, reorderSlots);
router.put("/admin/slots/:id", ...adminOnly, updateSlot);
router.patch("/admin/slots/:id/toggle", ...adminOnly, toggleSlot);
router.delete("/admin/slots/:id", ...adminOnly, deleteSlot);

export default router;
