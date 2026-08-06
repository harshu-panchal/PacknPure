/**
 * Seller Fallback Routing Service (additive — isolated from existing order workflow).
 *
 * When an item is not in admin/hub stock and requires seller procurement, this
 * service manages a sequential offer queue: the order is offered to sellers
 * one-by-one (price-sorted, cheapest first).  Each seller gets a window
 * (default 60 s) to accept.  On timeout or explicit rejection the offer
 * automatically advances to the next seller in the queue.  If all sellers
 * pass, the order is marked NO_SELLER_AVAILABLE and admins are notified.
 *
 * ── Design constraints ──
 * • Purely additive: does NOT modify any existing workflow logic.
 * • Reuses existing emitToSeller / createNotification / createNotificationBatch.
 * • Atomic accept/reject via conditional findOneAndUpdate guards.
 * • Idempotent timeout sweep: only advances if status + seller + index still match.
 */

import Order from "../models/order.js";
import Admin from "../models/admin.js";
import { createNotification, createNotificationBatch } from "./notificationService.js";
import { emitToSeller, emitToAdminOrdersRoom } from "./orderSocketEmitter.js";

// ─── configurable timeout ────────────────────────────────────────────────────
const SELLER_OFFER_TIMEOUT_MS = () =>
  parseInt(process.env.SELLER_OFFER_TIMEOUT_MS || "60000", 10);

// ─── helpers ─────────────────────────────────────────────────────────────────
const toStr = (v) => (v && typeof v === "object" && v._id ? String(v._id) : String(v || ""));

/**
 * Offer the order to the seller at `index` in `sellerQueue`.
 *
 * If `index` is past the end of the queue:
 *   → mark the order NO_SELLER_AVAILABLE and notify admins.
 *
 * Otherwise:
 *   → set currentSellerId / currentSellerIndex / offerExpiresAt / status
 *   → emit real-time socket event to the target seller
 *   → persist a notification in the database
 *
 * @param {string} orderId  Mongo _id or orderId of the order
 * @param {number} index    Zero-based index into sellerQueue
 */
export async function offerToSeller(orderId, index) {
  const order = await Order.findById(orderId);
  if (!order) {
    console.warn(`[SellerFallback] offerToSeller: order ${orderId} not found`);
    return null;
  }

  const queue = order.sellerQueue || [];

  // ── Queue exhausted → NO_SELLER_AVAILABLE ──────────────────────────────────
  if (index >= queue.length) {
    const updated = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: { $in: ["PENDING_SELLER", "pending"] },
      },
      {
        $set: {
          status: "NO_SELLER_AVAILABLE",
          currentSellerId: null,
          offerExpiresAt: null,
        },
      },
      { new: true },
    );

    if (!updated) {
      console.warn(`[SellerFallback] offerToSeller: could not mark NO_SELLER_AVAILABLE for ${orderId}`);
      return null;
    }

    // Notify every admin
    const admins = await Admin.find({}).select("_id").lean();
    if (admins.length) {
      await createNotificationBatch(
        admins.map((a) => ({
          recipient: a._id,
          recipientModel: "Admin",
          title: "No Seller Available",
          message: `Order #${updated.orderId} — all sellers exhausted. Manual intervention required.`,
          type: "system",
          data: { orderId: updated.orderId, mongoOrderId: String(updated._id) },
        })),
      );
    }

    emitToAdminOrdersRoom({
      event: "order:no_seller",
      payload: {
        orderId: updated.orderId,
        mongoOrderId: String(updated._id),
        status: "NO_SELLER_AVAILABLE",
      },
    });

    console.log(`[SellerFallback] Order ${updated.orderId} — NO_SELLER_AVAILABLE (queue exhausted at index ${index})`);
    return updated;
  }

  // ── Offer to the seller at `index` ─────────────────────────────────────────
  const entry = queue[index];
  const sellerId = toStr(entry.sellerId);
  const expiresAt = new Date(Date.now() + SELLER_OFFER_TIMEOUT_MS());

  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      // Guard: only advance from a "safe" state (prevents double-offer races)
      status: { $in: ["PENDING_SELLER", "pending", "NO_SELLER_AVAILABLE"] },
    },
    {
      $set: {
        status: "PENDING_SELLER",
        currentSellerIndex: index,
        currentSellerId: entry.sellerId,
        offerExpiresAt: expiresAt,
      },
    },
    { new: true },
  );

  if (!updated) {
    console.warn(`[SellerFallback] offerToSeller: atomic set failed for order ${orderId} index ${index}`);
    return null;
  }

  // Real-time socket push (reuses existing mechanism)
  emitToSeller(sellerId, {
    event: "seller:offer:new",
    payload: {
      orderId: updated.orderId,
      mongoOrderId: String(updated._id),
      sellerIndex: index,
      totalSellers: queue.length,
      expiresAt: expiresAt.toISOString(),
      timeoutSeconds: Math.round(SELLER_OFFER_TIMEOUT_MS() / 1000),
      productId: entry.productId ? String(entry.productId) : null,
      variantId: entry.variantId ? String(entry.variantId) : null,
      price: entry.price,
    },
  });

  // Persist in-app notification (reuses existing mechanism)
  await createNotification({
    recipient: entry.sellerId,
    recipientModel: "Seller",
    title: "New Order Offer",
    message: `You have ${Math.round(SELLER_OFFER_TIMEOUT_MS() / 1000)}s to accept order #${updated.orderId}.`,
    type: "order",
    data: {
      orderId: updated.orderId,
      mongoOrderId: String(updated._id),
      action: "seller_offer",
    },
  });

  console.log(
    `[SellerFallback] Offered order ${updated.orderId} to seller ${sellerId} (index ${index}/${queue.length - 1}, expires ${expiresAt.toISOString()})`,
  );
  return updated;
}

// ─── Accept ──────────────────────────────────────────────────────────────────

/**
 * Current seller accepts the offer.
 *
 * Atomic guard: must match orderId + currentSellerId + PENDING_SELLER status
 *               + offerExpiresAt > now.  Prevents double-accept and
 *               accept-after-timeout races.
 */
export async function acceptSellerOffer(orderId, sellerId) {
  const now = new Date();

  const updated = await Order.findOneAndUpdate(
    {
      _id: orderId,
      currentSellerId: sellerId,
      status: "PENDING_SELLER",
      offerExpiresAt: { $gt: now },
    },
    {
      $set: {
        status: "ACCEPTED",
        seller: sellerId,
        sellerAcceptedAt: now,
      },
    },
    { new: true },
  );

  if (!updated) {
    const err = new Error("Offer not available for acceptance — expired or already handled");
    err.statusCode = 409;
    throw err;
  }

  console.log(`[SellerFallback] Seller ${toStr(sellerId)} accepted order ${updated.orderId}`);
  return updated;
}

// ─── Reject ──────────────────────────────────────────────────────────────────

/**
 * Current seller explicitly rejects the offer.
 * Immediately advances to the next seller in the queue.
 */
export async function rejectSellerOffer(orderId, sellerId) {
  // Atomic guard: only the current seller while status is still PENDING_SELLER
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      currentSellerId: sellerId,
      status: "PENDING_SELLER",
    },
    {
      $set: {
        // Temporarily keep PENDING_SELLER — offerToSeller will overwrite
        offerExpiresAt: new Date(), // expire immediately
      },
    },
    { new: true },
  );

  if (!order) {
    const err = new Error("Offer not available to reject — already handled");
    err.statusCode = 409;
    throw err;
  }

  console.log(`[SellerFallback] Seller ${toStr(sellerId)} rejected order ${order.orderId} — advancing to next`);

  // Notify the rejecting seller
  emitToSeller(toStr(sellerId), {
    event: "seller:offer:rejected",
    payload: {
      orderId: order.orderId,
      mongoOrderId: String(order._id),
    },
  });

  // Advance to next seller
  return offerToSeller(order._id, (order.currentSellerIndex || 0) + 1);
}

// ─── Timeout Sweep (background job) ─────────────────────────────────────────

/**
 * Scans for orders whose PENDING_SELLER offer has expired and advances them
 * to the next seller.  Called periodically from sellerFallbackJob.
 *
 * Idempotent: only processes if status is still PENDING_SELLER and
 * offerExpiresAt <= now.
 */
export async function processSellerFallbackTimeouts() {
  const now = new Date();

  try {
    const expiredOrders = await Order.find({
      status: "PENDING_SELLER",
      offerExpiresAt: { $lte: now },
    })
      .select("_id orderId currentSellerIndex currentSellerId sellerQueue")
      .lean();

    if (!expiredOrders.length) return;

    for (const order of expiredOrders) {
      // Double-check atomically: only advance if still the same seller/index
      const guard = await Order.findOneAndUpdate(
        {
          _id: order._id,
          status: "PENDING_SELLER",
          currentSellerIndex: order.currentSellerIndex,
          currentSellerId: order.currentSellerId,
          offerExpiresAt: { $lte: now },
        },
        {
          $set: {
            // Stamp so we don't re-process on the next sweep
            offerExpiresAt: new Date(0),
          },
        },
        { new: true },
      );

      if (!guard) continue; // another process or accept already handled it

      // Notify the timed-out seller
      if (order.currentSellerId) {
        emitToSeller(toStr(order.currentSellerId), {
          event: "seller:offer:expired",
          payload: {
            orderId: order.orderId,
            mongoOrderId: String(order._id),
          },
        });
      }

      console.log(
        `[SellerFallback] Offer expired for order ${order.orderId} seller index ${order.currentSellerIndex} — advancing`,
      );

      await offerToSeller(order._id, (order.currentSellerIndex || 0) + 1);
    }
  } catch (error) {
    console.error("[SellerFallback] processSellerFallbackTimeouts error:", error.message);
  }
}

// ─── Initialization helper ───────────────────────────────────────────────────

/**
 * Populate the sellerQueue on an order and kick off the first offer.
 *
 * @param {string}  orderId             Mongo _id of the order
 * @param {Array}   priceSortedSellers  Array of { sellerId, price, productId, variantId }
 */
export async function initializeSellerQueueAndOffer(orderId, priceSortedSellers) {
  if (!Array.isArray(priceSortedSellers) || priceSortedSellers.length === 0) {
    console.warn(`[SellerFallback] initializeSellerQueueAndOffer: empty seller list for order ${orderId}`);
    return null;
  }

  await Order.updateOne(
    { _id: orderId },
    {
      $set: {
        sellerQueue: priceSortedSellers.map((s) => ({
          sellerId: s.sellerId,
          price: s.price || 0,
          productId: s.productId || null,
          variantId: s.variantId || null,
        })),
        currentSellerIndex: 0,
        currentSellerId: null,
        offerExpiresAt: null,
        status: "PENDING_SELLER",
      },
    },
  );

  return offerToSeller(orderId, 0);
}
