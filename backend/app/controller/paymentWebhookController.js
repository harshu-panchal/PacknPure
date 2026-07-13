import crypto from "crypto";
import dotenv from "dotenv";
import handleResponse from "../utils/helper.js";
import PaymentIntent from "../models/paymentIntent.js";
import Order from "../models/order.js";
import mongoose from "mongoose";
dotenv.config();

export const handleWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(500).send("Webhook secret not configured");

    const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
    if (signature !== expected) {
      console.warn("[WEBHOOK] Signature mismatch");
      return res.status(400).send("signature mismatch");
    }

    const event = payload.event;

    console.info("[WEBHOOK] Received", event);

    if (event === "payment.captured") {
      const payment = payload.payload.payment.entity;
      // Idempotent: mark PaymentIntent as completed if present
      const intent = await PaymentIntent.findOne({ razorpayOrderId: payment.order_id });
      if (intent) {
        intent.razorpayPaymentId = payment.id;
        intent.status = "completed";
        await intent.save();
      }
    }

    // TODO: handle payment.failed, refund.processed with idempotency

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[WEBHOOK] Error", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
