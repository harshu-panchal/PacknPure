import express from "express";
import { subscribeProductBackInStock } from "../controller/stockNotificationController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken, allowRoles("customer"));

router.post("/subscribe", subscribeProductBackInStock);

export default router;
