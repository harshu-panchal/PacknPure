import StockHistory from "../models/stockHistory.js";
import Transaction from "../models/transaction.js";
import { executeRollbackEvent } from "./transactionEngine.js";

/**
 * Reverse stock and fail seller transaction when an order is cancelled
 * after stock was deducted at placement.
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
}
