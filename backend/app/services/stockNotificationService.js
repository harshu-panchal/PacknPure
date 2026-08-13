import mongoose from "mongoose";
import StockNotificationRequest from "../models/stockNotificationRequest.js";
import Product from "../models/product.js";
import { createNotificationBatch } from "./notificationService.js";

/**
 * Subscribe a customer to be notified when a product (or a specific variant)
 * comes back in stock. Idempotent — re-subscribing after a previous
 * notification resets the "notified" flag so they get alerted again.
 */
export const subscribeToBackInStock = async ({ customerId, productId, variantId = null }) => {
  const filter = {
    customerId,
    productId,
    variantId: variantId || null,
  };

  const existing = await StockNotificationRequest.findOneAndUpdate(
    filter,
    { $setOnInsert: filter },
    { upsert: true, new: true },
  );

  if (existing.notified) {
    existing.notified = false;
    existing.notifiedAt = null;
    await existing.save();
  }

  return existing;
};

/**
 * Fire "back in stock" alerts to every customer with a pending subscription
 * for this product, then mark them notified so they aren't alerted again
 * until they resubscribe. Never throws — inventory mutations call this
 * fire-and-forget and shouldn't fail because a notification write failed.
 */
export const dispatchBackInStockNotifications = async (productId) => {
  try {
    if (!productId || !mongoose.Types.ObjectId.isValid(String(productId))) return;

    const pending = await StockNotificationRequest.find({
      productId,
      notified: false,
    })
      .select("_id customerId variantId")
      .lean();

    if (!pending.length) return;

    const product = await Product.findById(productId).select("name mainImage").lean();
    if (!product) return;

    await createNotificationBatch(
      pending.map((sub) => ({
        recipient: sub.customerId,
        recipientModel: "User",
        title: "Back in stock",
        message: `${product.name} is back in stock — grab it before it's gone again.`,
        type: "system",
        imageUrl: product.mainImage || "",
        data: { productId: String(productId), variantId: sub.variantId || null },
      })),
    );

    await StockNotificationRequest.updateMany(
      { _id: { $in: pending.map((s) => s._id) } },
      { $set: { notified: true, notifiedAt: new Date() } },
    );
  } catch (err) {
    console.warn("[stockNotificationService] dispatch failed:", err.message);
  }
};
