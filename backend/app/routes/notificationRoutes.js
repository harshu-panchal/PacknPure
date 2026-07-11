import express from "express";
import {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
    registerDeviceToken,
    removeDeviceToken,
    getMyNotificationPreferences,
    updateMyNotificationPreferences,
    broadcastNotifications,
    getBroadcastHistory,
} from "../controller/notificationController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes are protected
router.use(verifyToken);

router.get("/", getMyNotifications);
router.put("/mark-all-read", markAllAsRead);
router.put("/:id/read", markAsRead);
router.post("/device/register", registerDeviceToken);
router.delete("/device", removeDeviceToken);
router.get("/preferences", getMyNotificationPreferences);
router.put("/preferences", updateMyNotificationPreferences);
router.post("/broadcast", verifyToken, allowRoles("admin"), broadcastNotifications);
router.get("/broadcasts", verifyToken, allowRoles("admin"), getBroadcastHistory);

export default router;
