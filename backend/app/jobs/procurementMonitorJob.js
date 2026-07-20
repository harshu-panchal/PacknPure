import PurchaseRequest from "../models/purchaseRequest.js";
import Admin from "../models/admin.js";
import { fallbackPurchaseRequest } from "../services/hubOrderOrchestrator.js";
import { createNotificationBatch } from "../services/notificationService.js";
import { markAllocationTimeout } from "../services/procurementSessionService.js";
import { executeRollbackEvent } from "../services/transactionEngine.js";

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

const processExpirations = async () => {
  const now = new Date();
  try {
    const expiredPRs = await PurchaseRequest.find({
      status: "created",
      expiresAt: { $lte: now },
    }).select("_id requestId").lean();

    if (!expiredPRs.length) return;

    for (const pr of expiredPRs) {
      // Mark as expired and fallback
      await PurchaseRequest.updateOne({ _id: pr._id }, { $set: { status: "expired" } });
      const fullPr = await PurchaseRequest.findById(pr._id);
      if (fullPr?.procurementSessionId && fullPr?.allocationId) {
        await markAllocationTimeout({
          procurementSessionId: fullPr.procurementSessionId,
          allocationId: fullPr.allocationId,
        });
      }
      await executeRollbackEvent({
        eventType: "SELLER_TIMEOUT",
        transactionId: `seller_timeout:${String(fullPr?._id || pr._id)}`,
        orderId: fullPr?.orderId || null,
        purchaseRequestId: fullPr?._id || null,
        allocationId: fullPr?.allocationId || null,
        reason: "procurement_request_expired",
        actor: { type: "system" },
      });
      await fallbackPurchaseRequest(pr._id);
      console.log(`[ProcurementMonitor] PR ${pr.requestId} expired. Triggered fallback and released commitments.`);
    }
  } catch (error) {
    console.error("[ProcurementMonitor] processExpirations error:", error.message);
  }
};

const processPickupTimeouts = async () => {
  const Setting = (await import("../models/setting.js")).default;
  const settings = await Setting.findOne().lean();
  const timeoutMs = (settings?.pickupTimeout || 120) * 60 * 1000;
  const cutoff = new Date(Date.now() - timeoutMs);
  try {
    const stalledPRs = await PurchaseRequest.find({
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
  const Setting = (await import("../models/setting.js")).default;
  const settings = await Setting.findOne().lean();
  const timeoutMs = (settings?.hubReceiveTimeout || 180) * 60 * 1000;
  const cutoff = new Date(Date.now() - timeoutMs);
  try {
    const stalledPRs = await PurchaseRequest.find({
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
