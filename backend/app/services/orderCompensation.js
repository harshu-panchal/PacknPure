import mongoose from "mongoose";
import Product from "../models/product.js";
import StockHistory from "../models/stockHistory.js";
import Transaction from "../models/transaction.js";

/**
 * Reverse stock and fail seller transaction when an order is cancelled
 * after stock was deducted at placement.
 */
export async function compensateOrderCancellation(order, orderIdString) {
  for (const item of order.items) {
    const reservedToRelease = order.hubFlowEnabled && item.hubReservedQty !== undefined ? item.hubReservedQty : item.quantity;

    if (reservedToRelease > 0) {
      if (item.variantId) {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { stock: reservedToRelease, "variants.$[elem].stock": reservedToRelease } },
          { arrayFilters: [{ "elem._id": new mongoose.Types.ObjectId(item.variantId) }] }
        );
      } else {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: reservedToRelease },
        });
      }

      await StockHistory.create({
        product: item.product,
        seller: order.seller,
        type: "Correction",
        quantity: reservedToRelease,
        note: `Order #${orderIdString} Cancelled (Reversed Hub Qty)`,
        order: order._id,
      });
    }
    // --- HUB STOCK REVERSAL ---
    if (order.hubFlowEnabled) {
      try {
        const HubInventory = (await import("../models/hubInventory.js")).default;
        const hubId = process.env.DEFAULT_HUB_ID || "MAIN_HUB";
        
        if (reservedToRelease > 0) {
          await HubInventory.findOneAndUpdate(
            { hubId, productId: item.product },
            { 
              $inc: { 
                availableQty: reservedToRelease,
                reservedQty: -reservedToRelease
              } 
            }
          );
          console.log(`[InventorySync] Reversed ${reservedToRelease} units from reserved to available for Order #${orderIdString}`);
        }
      } catch (err) {
        console.warn("[InventorySync] Hub reversal failed during compensation:", err.message);
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
        status: { $nin: ["verified", "closed", "cancelled"] }
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
