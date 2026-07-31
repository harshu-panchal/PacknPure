/**
 * Procurement Retry Batch Job
 *
 * Fires after a configurable delay (procurementRetryBatchDelayMinutes in Settings)
 * following the first seller rejection/timeout in a wave. Instead of creating one
 * new PR per rejected line immediately, we wait for all concurrent rejections to
 * settle, then re-run the full allocation + grouping pipeline on ALL remaining
 * unfulfilled items from the ProcurementSession.
 *
 * This ensures that when retrying, items going to the same next seller are correctly
 * bundled into a single multi-product PR (same as the initial creation flow).
 */

import ProcurementSession from "../models/procurementSession.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import { procurementRetryQueue, JOB_NAMES } from "../queues/orderQueues.js";
import { getUncoveredRemainingQty } from "../services/procurementSessionService.js";
import { createAutoPurchaseRequests } from "../services/hubOrderOrchestrator.js";

const toInt = (v) => Math.max(0, Number(v || 0));

/**
 * Core logic executed by the Bull job.
 * @param {{ orderId: string, procurementSessionId: string }} data
 */
const executeRetryBatch = async ({ orderId, procurementSessionId }) => {
  if (!orderId || !procurementSessionId) {
    console.warn("[ProcurementRetryJob] Missing orderId or procurementSessionId — skipping.");
    return;
  }

  const session = await ProcurementSession.findById(procurementSessionId);
  if (!session) {
    console.warn(`[ProcurementRetryJob] Session ${procurementSessionId} not found.`);
    return;
  }

  if (session.status !== "open") {
    console.log(
      `[ProcurementRetryJob] Session ${procurementSessionId} is ${session.status} — no retry needed.`,
    );
    // Still reset the lock so future rejections can schedule
    await ProcurementSession.findByIdAndUpdate(procurementSessionId, {
      $set: { retryBatchScheduledAt: null },
    });
    return;
  }

  const order = await Order.findById(orderId).lean();
  if (!order) {
    console.warn(`[ProcurementRetryJob] Order ${orderId} not found — skipping retry batch.`);
    await ProcurementSession.findByIdAndUpdate(procurementSessionId, {
      $set: { retryBatchScheduledAt: null },
    });
    return;
  }

  // Collect items that still have uncovered remaining qty
  const uncoveredItems = (session.items || []).filter(
    (item) => getUncoveredRemainingQty(session, item.itemKey) > 0,
  );

  if (uncoveredItems.length === 0) {
    console.log(
      `[ProcurementRetryJob] All items fulfilled for order ${orderId} — nothing to retry.`,
    );
    await ProcurementSession.findByIdAndUpdate(procurementSessionId, {
      $set: { retryBatchScheduledAt: null },
    });
    return;
  }

  // Bulk-load product data for all uncovered items
  const productIds = [...new Set(uncoveredItems.map((i) => String(i.productId)))];
  const products = await Product.find({ _id: { $in: productIds } })
    .select(
      "_id sellerId name categoryId subcategoryId ownerType stock price salePrice purchasePrice variants gstRate gstEnabled",
    )
    .lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  // Reconstruct the shortages array from the uncovered session items.
  // vendorId: null forces a fresh allocation ranking (no pre-assigned vendor).
  const shortages = uncoveredItems
    .map((item) => {
      const shortageQty = getUncoveredRemainingQty(session, item.itemKey);
      if (shortageQty <= 0) return null;
      return {
        productId: String(item.productId),
        variantId: item.variantId ? String(item.variantId) : null,
        requiredQty: toInt(item.requiredQty),
        availableQtyAtHub: 0,
        shortageQty,
        vendorId: null, // force fresh seller selection
        baseProduct: productMap.get(String(item.productId)) || null,
      };
    })
    .filter(Boolean);

  if (shortages.length === 0) {
    console.log(`[ProcurementRetryJob] No valid shortages for order ${orderId} — resetting lock.`);
    await ProcurementSession.findByIdAndUpdate(procurementSessionId, {
      $set: { retryBatchScheduledAt: null },
    });
    return;
  }

  console.log(
    `[ProcurementRetryJob] Re-running allocation for order ${orderId} ` +
      `(${shortages.length} unfulfilled item(s))`,
  );

  try {
    // Re-run the full initial creation pipeline:
    // rankSellerAllocations → groupEnrichedShortagesByVendor → createSellerGroupedPurchaseRequests
    // This correctly re-groups items going to the same seller into a single PR.
    const newPrs = await createAutoPurchaseRequests({
      order,
      shortages,
      hubId: session.hubId || "MAIN_HUB",
      allowUnassigned: false,
    });

    console.log(
      `[ProcurementRetryJob] Created ${newPrs.length} grouped PR(s) for order ${orderId}.`,
    );
  } catch (err) {
    // createAutoPurchaseRequests throws when items are out of stock (allowUnassigned=false).
    // markProcurementExhausted inside it handles notification + cancel/hold.
    console.error(
      `[ProcurementRetryJob] Re-allocation failed for order ${orderId}:`,
      err.message,
    );
  }

  // Always reset the lock so future rejection waves can schedule a new batch
  await ProcurementSession.findByIdAndUpdate(procurementSessionId, {
    $set: { retryBatchScheduledAt: null },
  });
};

let _jobStarted = false;

/**
 * Register the Bull processor and start listening on the procurement-retry queue.
 * Called once at server startup from index.js.
 */
export const startProcurementRetryJob = () => {
  if (_jobStarted) return;
  _jobStarted = true;

  procurementRetryQueue.process(JOB_NAMES.PROCUREMENT_RETRY, async (job) => {
    console.log(
      `[ProcurementRetryJob] Processing retry batch for order ${job.data?.orderId}`,
    );
    await executeRetryBatch(job.data);
  });

  procurementRetryQueue.on("failed", (job, err) => {
    console.error(
      `[ProcurementRetryJob] Job failed for order ${job.data?.orderId}:`,
      err.message,
    );
  });

  console.log("[ProcurementRetryJob] Processor registered on 'procurement-retry' queue.");
};

export default startProcurementRetryJob;
