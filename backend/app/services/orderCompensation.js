import mongoose from "mongoose";
import Product from "../models/product.js";
import StockHistory from "../models/stockHistory.js";
import Transaction from "../models/transaction.js";

/**
 * Reverse stock and fail seller transaction when an order is cancelled
 * after stock was deducted at placement.
 */
export async function compensateOrderCancellation(order, orderIdString) {
  const { handleCustomerCancellation } = await import("./inventoryLifecycleService.js");
  for (const item of order.items) {
    const qtyToRelease = order.hubFlowEnabled && item.hubReservedQty !== undefined ? item.hubReservedQty : item.quantity;

    if (qtyToRelease > 0) {
      if (order.hubFlowEnabled) {
        await handleCustomerCancellation(item.product, item.variantId, qtyToRelease, "before_pickup_hub");
      } else {
        await handleCustomerCancellation(item.product, item.variantId, qtyToRelease, "before_pickup_seller");
      }

      if (order.seller) {
        await StockHistory.create({
          product: item.product,
          seller: order.seller,
          type: "Correction",
          quantity: qtyToRelease,
          note: `Order #${orderIdString} Cancelled (Reversed Qty)`,
          order: order._id,
        });
      }
    }
  }

  // Cancel any open Purchase Requests for this order
  if (order.hubFlowEnabled) {
    try {
      const PurchaseRequest = (await import("../models/purchaseRequest.js")).default;
      const { releasePurchaseRequestCommitments } = await import("./hubOrderOrchestrator.js");
      
      const pendingPRs = await PurchaseRequest.find({
        orderId: order._id,
        status: { $in: ["created", "seller_confirmed", "pickup_assigned"] }
      });
      
      for (const pr of pendingPRs) {
        await releasePurchaseRequestCommitments(pr);
        pr.status = "cancelled";
        pr.exceptionReason = "Order cancelled";
        await pr.save();
      }
    } catch (e) {
      console.warn("[OrderCompensation] Failed to cancel open PRs:", e.message);
    }
  }

  await Transaction.findOneAndUpdate(
    { reference: orderIdString },
    { status: "Failed" },
  );
}
