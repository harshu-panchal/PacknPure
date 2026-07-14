import crypto from "crypto";
import dotenv from "dotenv";
import handleResponse from "../utils/helper.js";
import PaymentIntent from "../models/paymentIntent.js";
import Order from "../models/order.js";
import User from "../models/customer.js";
import Transaction from "../models/transaction.js";
import mongoose from "mongoose";
dotenv.config();

/**
 * WEBHOOK HANDLER - Handle all Razorpay payment events
 * 
 * CRITICAL:
 * - Signature must be verified
 * - Must be idempotent (handle retries)
 * - Must prevent duplicate order creation
 * - Must handle: payment.captured, payment.authorized, payment.failed, refund.processed
 */
export const handleWebhook = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payload = req.body;
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      console.error("[WEBHOOK] Webhook secret not configured");
      return res.status(500).json({ ok: false, error: "Webhook secret not configured" });
    }

    // === 1. VERIFY WEBHOOK SIGNATURE ===
    const expected = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    if (signature !== expected) {
      await session.abortTransaction();
      session.endSession();
      console.warn("[WEBHOOK] Signature verification failed", { signature, expected });
      return res.status(400).json({ ok: false, error: "Invalid signature" });
    }

    const event = payload.event;
    console.info("[WEBHOOK] Verified event received", { event, eventId: payload.id });

    // === 2. HANDLE SPECIFIC EVENTS ===
    if (event === "payment.captured" || event === "payment.authorized") {
      const payment = payload.payload.payment.entity;
      const { id: paymentId, order_id: razorpayOrderId, amount, status } = payment;

      // IDEMPOTENCY: Check if this payment was already processed
      const existingIntent = await PaymentIntent.findOne({
        razorpayPaymentId: paymentId,
      }).session(session);

      if (existingIntent) {
        // Already processed - avoid duplicate processing
        console.info("[WEBHOOK] Payment already processed (idempotent)", {
          paymentId,
          intentId: existingIntent._id.toString(),
        });

        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({
          ok: true,
          message: "Payment already processed",
          isDuplicate: true,
        });
      }

      // Find payment intent by razorpay order ID
      const intent = await PaymentIntent.findOne({
        razorpayOrderId,
      }).session(session);

      if (!intent) {
        console.warn("[WEBHOOK] Payment intent not found", {
          razorpayOrderId,
          paymentId,
        });

        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({
          ok: true,
          message: "Payment intent not found - may be legacy",
        });
      }

      // === CRITICAL: Check for duplicate order ===
      const existingOrder = await Order.findOne({
        customer: intent.user,
        "payment.transactionId": paymentId,
      }).session(session);

      if (existingOrder) {
        console.warn("[WEBHOOK] Order already exists for this payment", {
          paymentId,
          orderId: existingOrder.orderId,
        });

        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({
          ok: true,
          message: "Order already created for this payment",
          isDuplicate: true,
        });
      }

      // Update payment intent
      intent.razorpayPaymentId = paymentId;
      intent.status = "completed";
      await intent.save({ session });

      console.info("[WEBHOOK] Payment captured/authorized", {
        paymentId,
        intentId: intent._id.toString(),
        amount,
      });

      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({ ok: true, message: "Payment captured" });

    } else if (event === "payment.failed") {
      const payment = payload.payload.payment.entity;
      const { id: paymentId, order_id: razorpayOrderId } = payment;

      // Update payment intent to failed
      const intent = await PaymentIntent.findOne({
        razorpayOrderId,
      }).session(session);

      if (intent) {
        intent.status = "failed";
        intent.razorpayPaymentId = paymentId;
        await intent.save({ session });

        console.info("[WEBHOOK] Payment failed", {
          paymentId,
          intentId: intent._id.toString(),
          reason: payment.description,
        });
      }

      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({ ok: true, message: "Payment failure recorded" });

    } else if (event === "refund.processed") {
      const refund = payload.payload.refund.entity;
      const { id: refundId, payment_id: paymentId, amount } = refund;

      // Check if transaction already exists for this refund
      const existingTransaction = await Transaction.findOne({
        reference: refundId,
      }).session(session);

      if (existingTransaction) {
        console.info("[WEBHOOK] Refund already processed (idempotent)", {
          refundId,
          paymentId,
        });

        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({
          ok: true,
          message: "Refund already processed",
          isDuplicate: true,
        });
      }

      // Find order by payment ID
      const order = await Order.findOne({
        "payment.transactionId": paymentId,
      }).session(session);

      if (order) {
        // Create refund transaction
        const transaction = new Transaction({
          user: order.customer,
          userModel: "User",
          order: order._id,
          type: "Refund",
          amount: amount / 100, // Razorpay sends in paise
          status: "Settled",
          reference: refundId,
          meta: {
            gateway: "razorpay",
            orderId: order.orderId,
            originalPaymentId: paymentId,
          },
        });
        await transaction.save({ session });

        // Add refund amount back to wallet
        const user = await User.findById(order.customer).session(session);
        if (user) {
          user.walletBalance = (user.walletBalance || 0) + (amount / 100);
          await user.save({ session });
        }

        console.info("[WEBHOOK] Refund processed", {
          refundId,
          paymentId,
          orderId: order.orderId,
          amount: amount / 100,
        });
      }

      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({ ok: true, message: "Refund processed" });

    } else {
      // Unknown event - still acknowledge it
      console.info("[WEBHOOK] Unknown event type", { event });
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({ ok: true, message: "Event received" });
    }

  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {}
    session.endSession();

    console.error("[WEBHOOK] Error processing webhook", {
      error: error.message,
      stack: error.stack,
    });

    // IMPORTANT: Always acknowledge the webhook to Razorpay
    // Even on error, return 200 to prevent webhook retries
    return res.status(200).json({
      ok: false,
      error: error.message,
      message: "Error processing webhook - will retry",
    });
  }
};

