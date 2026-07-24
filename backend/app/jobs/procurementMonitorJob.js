import Admin from "../models/admin.js";
import {
  fallbackPurchaseRequest,
  fallbackPurchaseRequestLine,
  updateOnePurchaseRequest,
  findPurchaseRequests,
  findPurchaseRequestById,
} from "../services/purchaseRequestService.js";
import { createNotificationBatch } from "../services/notificationService.js";
import { markAllocationTimeout, releaseAllocationSellerStock } from "../services/procurementSessionService.js";
import { getPickupTimeoutMs, getHubReceiveTimeoutMs } from "../services/settingsService.js";
import { scheduleRetryBatch } from "../services/hubOrderOrchestrator.js";

const toInt = (v) => Math.max(0, Number(v || 0));
const MONITOR_INTERVAL_MS = 60 * 1000; // Check every 1 minute

const notifyAdmins = async (title, message, data = {}) => {
  const admins = await Admin.find({}).select("_id").lean();
  const adminIds = admins.map((a) => a?._id).filter(Boolean);
  if (adminIds.length) {
    await createNotificationBatch(
      adminIds.map((adminId) => ({
        recipient: adminId,
        recipientModel: "Admin",
        title,
        message,
        type: "system",
        data,
      })),
    );
  }
};

export const processExpirations = async () => {
  const now = new Date();
  try {
    const expiredPRs = await findPurchaseRequests({
      status: "created",
      expiresAt: { $lte: now },
    }).select("_id requestId orderId requestType").lean();

    if (!expiredPRs.length) return;

    for (const pr of expiredPRs) {
      // Standalone Manual PR: release ALL lines + set expired in ONE transaction.
      // Do not flip status before inventory (prevents stuck commits on release failure).
      if (!pr.orderId) {
        try {
          const { expireStandaloneManualPR } = await import(
            "../services/manualPurchaseRequestInventoryService.js"
          );
          await expireStandaloneManualPR(pr._id);
        } catch (manualExpireErr) {
          console.error(
            `[ProcurementMonitor] Failed manual PR atomic expiration for ${pr.requestId}:`,
            manualExpireErr.message,
          );
        }
        continue;
      }

      const updateResult = await updateOnePurchaseRequest(
        { _id: pr._id, status: "created" },
        { $set: { status: "expired" } },
      );
      if (updateResult.modifiedCount !== 1) continue;

      const fullPr = await findPurchaseRequestById(pr._id);

      const isMultiLine = (fullPr?.items || []).length > 1;

      if (isMultiLine) {
        for (const line of fullPr.items || []) {
          const row = line.toObject ? line.toObject() : line;
          const lineStatus = String(row.lineStatus || "pending").toLowerCase();
          if (lineStatus !== "pending") continue;

          const allocId = row.allocationId || fullPr.allocationId;
          const retryQty = toInt(row.remainingQty || row.requestedQty || row.shortageQty);
          if (retryQty <= 0) continue;

          if (fullPr.procurementSessionId && allocId) {
            await markAllocationTimeout({
              procurementSessionId: fullPr.procurementSessionId,
              allocationId: allocId,
            });
            await releaseAllocationSellerStock({
              procurementSessionId: fullPr.procurementSessionId,
              allocationId: allocId,
              purchaseRequestId: fullPr._id,
              orderId: fullPr.orderId || null,
              quantity: retryQty,
              eventType: "SELLER_TIMEOUT",
              reason: "procurement_request_expired_line",
              actor: { type: "system" },
              transactionId: `pr_timeout_release:${String(fullPr._id)}:${String(allocId)}`,
            });
          } else if (row.selectedSellerProductId) {
            const { executeRollbackEvent } = await import("../services/transactionEngine.js");
            await executeRollbackEvent({
              eventType: "SELLER_TIMEOUT",
              transactionId: `pr_timeout_release_noses:${String(fullPr._id)}:${String(row.productId)}:${retryQty}`,
              orderId: fullPr.orderId || null,
              purchaseRequestId: fullPr._id,
              allocationId: allocId || null,
              quantity: retryQty,
              reason: "procurement_request_expired_line_no_session",
              actor: { type: "system" },
            });
          }

          // Allocation released — now schedule the grouped retry batch.
          // All concurrent line expirations for this order share the same batch job.
          await fallbackPurchaseRequestLine(
            fullPr._id,
            row.productId,
            row.variantId || null,
            retryQty,
          );
        }
      } else {
        if (fullPr?.procurementSessionId && fullPr?.allocationId) {
          await markAllocationTimeout({
            procurementSessionId: fullPr.procurementSessionId,
            allocationId: fullPr.allocationId,
          });
          await releaseAllocationSellerStock({
            procurementSessionId: fullPr.procurementSessionId,
            allocationId: fullPr.allocationId,
            purchaseRequestId: fullPr._id,
            orderId: fullPr.orderId || null,
            eventType: "SELLER_TIMEOUT",
            reason: "procurement_request_expired",
            actor: { type: "system" },
            transactionId: `pr_timeout_release:${String(fullPr._id)}:${String(fullPr.allocationId)}`,
          });
        }
        // Allocation released — schedule the grouped retry batch.
        await fallbackPurchaseRequest(fullPr._id);
      }
      console.log(`[ProcurementMonitor] PR ${pr.requestId} expired. Triggered fallback and released commitments.`);
    }
  } catch (error) {
    console.error("[ProcurementMonitor] processExpirations error:", error.message);
  }
};

const processPickupTimeouts = async () => {
  const timeoutMs = await getPickupTimeoutMs();
  const cutoff = new Date(Date.now() - timeoutMs);
  try {
    const stalledPRs = await findPurchaseRequests({
      status: "pickup_assigned",
      updatedAt: { $lte: cutoff }, // Proxy for when it was assigned
    }).select("_id requestId pickupPartnerId").lean();

    if (!stalledPRs.length) return;

    for (const pr of stalledPRs) {
      await notifyAdmins(
        "Pickup Timeout Alert",
        `PR ${pr.requestId} has been waiting for pickup for over 2 hours.`,
        { purchaseRequestId: pr._id }
      );
      // We don't auto-cancel yet, just alert admin
      console.log(`[ProcurementMonitor] Alerted admin for PR ${pr.requestId} pickup timeout.`);
    }
  } catch (error) {
    console.error("[ProcurementMonitor] processPickupTimeouts error:", error.message);
  }
};

const processHubReceiveTimeouts = async () => {
  const timeoutMs = await getHubReceiveTimeoutMs();
  const cutoff = new Date(Date.now() - timeoutMs);
  try {
    const stalledPRs = await findPurchaseRequests({
      status: "picked",
      "pickupProof.pickedAt": { $lte: cutoff },
    }).select("_id requestId pickupPartnerId").lean();

    if (!stalledPRs.length) return;

    for (const pr of stalledPRs) {
      await notifyAdmins(
        "Hub Receive Timeout Alert",
        `PR ${pr.requestId} was picked up but hasn't reached the hub for over 3 hours.`,
        { purchaseRequestId: pr._id }
      );
      console.log(`[ProcurementMonitor] Alerted admin for PR ${pr.requestId} hub receive timeout.`);
    }
  } catch (error) {
    console.error("[ProcurementMonitor] processHubReceiveTimeouts error:", error.message);
  }
};

export const startProcurementMonitorJob = () => {
  if (globalThis.__PROCUREMENT_MONITOR_JOB_STARTED__) return;
  globalThis.__PROCUREMENT_MONITOR_JOB_STARTED__ = true;
  console.log(`[ProcurementMonitorJob] Started with interval ${MONITOR_INTERVAL_MS}ms`);
  
  setInterval(() => {
    void processExpirations();
    void processPickupTimeouts();
    void processHubReceiveTimeouts();
  }, MONITOR_INTERVAL_MS);
  
  void processExpirations();
};

export default startProcurementMonitorJob;
