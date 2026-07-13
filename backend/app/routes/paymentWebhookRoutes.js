import express from "express";
import { handleWebhook } from "../controller/paymentWebhookController.js";

const router = express.Router();

// Webhooks cannot rely on auth middleware; verify signature server-side
router.post("/", express.json({ type: '*/*' }), handleWebhook);

export default router;
