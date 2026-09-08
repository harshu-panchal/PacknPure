import Order from "../models/order.js";
import User from "../models/customer.js";
import StockHistory from "../models/stockHistory.js";
import Transaction from "../models/transaction.js";
import { executeRollbackEvent } from "./transactionEngine.js";
import { createNotification } from "./notificationService.js";

const PREPAID_METHODS = new Set(["online", "wallet", "card", "upi"]);

/**
 * Money the customer has actually parted with on this order.
 * COD orders are never prepaid, so nothing is owed back on cancellation.
 */
function refundableAmount(order) {
  const method = String(order?.payment?.method || "").toLowerCase();
  const status = String(order?.payment?.status || "").toLowerCase();

  if (status !== "completed") return 0;
  if (!PREPAID_METHODS.has(method)) return 0;

  const paid = Number(order?.payment?.paidAmount || 0);
  const total = Number(order?.pricing?.total || 0);
  const amount = paid > 0 ? paid : total;

  return amount > 0 ? Number(amount.toFixed(2)) : 0;
}

/**
 * Return a prepaid customer's money when their order is cancelled.
 *
 * Refunds land in the customer's wallet, matching how the return flow already
 * settles refunds. Cancellation previously did none of this: stock came back and
 * the seller transaction was failed, but an online- or wallet-paid customer whose
 * order was auto-cancelled (e.g. no rider found) simply lost the money.
 *
 * Idempotent on two levels — the `payment.status === "refunded"` guard and a unique
 * `REFUND-<orderId>` transaction reference — so a retried or duplicated
 * cancellation cannot pay out twice.
 */
export async function refundCancelledOrder(order, orderIdString) {
  const amount = refundableAmount(order);
  if (amount <= 0) return null;

  const customerId = order?.customer?._id || order?.customer;
  if (!customerId) {
    console.error(
      `[refundCancelledOrder] Order ${orderIdString} has no customer — refund of ${amount} skipped`,
    );
    return null;
  }

  const reference = `REFUND-${orderIdString}`;
  const existing = await Transaction.findOne({ reference }).lean();
  if (existing) return null;

  const customer = await User.findById(customerId);
  if (!customer) {
    console.error(
      `[refundCancelledOrder] Customer ${customerId} not found — refund of ${amount} skipped for ${orderIdString}`,
    );
    return null;
  }

  customer.walletBalance = Number(
    (Number(customer.walletBalance || 0) + amount).toFixed(2),
  );
  await customer.save();

  await Transaction.create({
    user: customer._id,
    userModel: "User",
    order: order._id,
    type: "Refund",
    amount,
    status: "Settled",
    reference,
    meta: {
      orderId: orderIdString,
      reason: order.cancelReason || "Order cancelled",
      originalMethod: order?.payment?.method || null,
    },
  });

  await Order.updateOne(
    { _id: order._id },
    { $set: { "payment.status": "refunded" } },
  );
  if (order.payment) order.payment.status = "refunded";

  try {
    await createNotification({
      recipient: customer._id,
      recipientModel: "User",
      title: "Refund Credited",
      message: `₹${amount} for cancelled order #${orderIdString} has been credited to your wallet.`,
      type: "order",
      data: { orderId: orderIdString, mongoOrderId: order._id, refundAmount: amount },
    });
  } catch (notifyErr) {
    console.warn("[refundCancelledOrder] notification failed:", notifyErr.message);
  }

  return amount;
}

/**
 * Reverse stock, refund the customer, and fail the seller transaction when an
 * order is cancelled after stock was deducted at placement.
 */
export async function compensateOrderCancellation(order, orderIdString) {
  await executeRollbackEvent({
    eventType: "ORDER_CANCELLED",
    transactionId: `order_cancel:${String(order._id)}`,
    orderId: order._id,
    reason: "order_cancelled_compensation",
    actor: { type: "system" },
    metadata: { orderCode: orderIdString },
  });

  for (const item of order.items || []) {
    if (!order.seller) continue;
    if (!item.variantId) continue; // variant-level history only
    const qtyToRelease = Math.max(0, Number(item.hubReservedQty || item.quantity || 0));
    if (qtyToRelease <= 0) continue;
    await StockHistory.create({
      product: item.product,
      seller: order.seller,
      type: "Correction",
      quantity: qtyToRelease,
      note: `Order #${orderIdString} rollback:${qtyToRelease}`,
      order: order._id,
    });
  }

  await Transaction.findOneAndUpdate(
    { reference: orderIdString },
    { status: "Failed" },
  );

  // Never let a refund failure abort the rest of the cancellation — the order must
  // still end up cancelled, and an unpaid refund is recoverable from the logs.
  try {
    await refundCancelledOrder(order, orderIdString);
  } catch (refundErr) {
    console.error(
      `[compensateOrderCancellation] Refund failed for ${orderIdString}:`,
      refundErr.message,
    );
  }
}
