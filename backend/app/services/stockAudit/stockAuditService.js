import StockAuditSession from "../../models/stockAuditSession.js";
import { getNextSequenceValue } from "../posSequenceService.js";
import { resolveBarcodeForAudit } from "./stockAuditLookupService.js";

const ACTIVE_STATUSES = ["draft", "in_progress", "paused"];

async function generateSessionCode() {
  const seq = await getNextSequenceValue("stock_audit_session");
  const padded = String(seq).padStart(6, "0");
  return `AUD-${new Date().getFullYear()}-${padded}`;
}

function assertCanAccessSession(session, user) {
  const role = String(user?.role || "").toLowerCase();
  if (role === "admin") return true;
  if (role === "seller") {
    return (
      session.createdByRole === "seller" &&
      String(session.sellerId) === String(user.id)
    );
  }
  return false;
}

function serializeSession(session) {
  const plain =
    typeof session.toObject === "function" ? session.toObject() : { ...session };
  const summary = session.buildSummary
    ? session.buildSummary()
    : { totalSkus: 0, matched: 0, short: 0, over: 0, totalExpected: 0, totalCounted: 0, totalDifference: 0 };

  const lines = (plain.lines || []).map((line) => {
    const expected = Math.max(0, Number(line.expectedQty) || 0);
    const counted = Math.max(0, Number(line.countedQty) || 0);
    const difference = counted - expected;
    let status = "matched";
    if (difference < 0) status = "short";
    else if (difference > 0) status = "over";
    return {
      ...line,
      expectedQty: expected,
      countedQty: counted,
      difference,
      status,
    };
  });

  return {
    ...plain,
    lines,
    summary,
    // Explicit: this module never mutates inventory.
    inventoryMutations: false,
  };
}

export async function createAuditSession(user, payload = {}) {
  const role = String(user?.role || "").toLowerCase();
  let locationType = String(payload.locationType || "").toLowerCase();
  let sellerId = payload.sellerId || null;
  let locationLabel = String(payload.locationLabel || "").trim();
  const hubId = String(payload.hubId || "MAIN_HUB").trim() || "MAIN_HUB";

  if (role === "seller") {
    locationType = "seller_store";
    sellerId = user.id;
    if (!locationLabel) locationLabel = "My Store";
  } else {
    if (!["hub", "warehouse", "seller_store"].includes(locationType)) {
      const err = new Error("locationType must be hub, warehouse, or seller_store");
      err.code = "AUDIT_VALIDATION";
      throw err;
    }
    if (locationType === "seller_store" && !sellerId) {
      const err = new Error("sellerId is required for seller_store audits");
      err.code = "AUDIT_VALIDATION";
      throw err;
    }
    if (!locationLabel) {
      locationLabel =
        locationType === "hub"
          ? `Hub ${hubId}`
          : locationType === "warehouse"
            ? "Warehouse"
            : "Seller Store";
    }
  }

  const session = await StockAuditSession.create({
    sessionCode: await generateSessionCode(),
    locationType,
    locationLabel,
    hubId,
    sellerId: locationType === "seller_store" ? sellerId : null,
    status: "draft",
    createdBy: user.id,
    createdByRole: role === "seller" ? "seller" : "admin",
    notes: String(payload.notes || "").trim(),
    lines: [],
    approval: {
      status: "not_required",
      appliedToInventory: false,
    },
  });

  return serializeSession(session);
}

export async function listAuditSessions(user, query = {}) {
  const role = String(user?.role || "").toLowerCase();
  const filter = {};

  if (role === "seller") {
    filter.sellerId = user.id;
    filter.createdByRole = "seller";
  } else if (query.sellerId) {
    filter.sellerId = query.sellerId;
  }

  if (query.status) filter.status = query.status;
  if (query.locationType) filter.locationType = query.locationType;

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    StockAuditSession.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockAuditSession.countDocuments(filter),
  ]);

  return {
    items: items.map((s) => {
      const fake = {
        ...s,
        buildSummary() {
          const lines = s.lines || [];
          let matched = 0;
          let short = 0;
          let over = 0;
          let totalExpected = 0;
          let totalCounted = 0;
          for (const line of lines) {
            const expected = Math.max(0, Number(line.expectedQty) || 0);
            const counted = Math.max(0, Number(line.countedQty) || 0);
            const difference = counted - expected;
            totalExpected += expected;
            totalCounted += counted;
            if (difference < 0) short += 1;
            else if (difference > 0) over += 1;
            else matched += 1;
          }
          return {
            totalSkus: lines.length,
            matched,
            short,
            over,
            totalExpected,
            totalCounted,
            totalDifference: totalCounted - totalExpected,
          };
        },
        toObject() {
          return s;
        },
      };
      return serializeSession(fake);
    }),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit) || 1),
  };
}

export async function getAuditSession(user, sessionId) {
  const session = await StockAuditSession.findById(sessionId);
  if (!session) {
    const err = new Error("Audit session not found");
    err.code = "AUDIT_NOT_FOUND";
    throw err;
  }
  if (!assertCanAccessSession(session, user)) {
    const err = new Error("Not authorized to view this audit");
    err.code = "AUDIT_FORBIDDEN";
    throw err;
  }
  return serializeSession(session);
}

export async function transitionAuditStatus(user, sessionId, action) {
  const session = await StockAuditSession.findById(sessionId);
  if (!session) {
    const err = new Error("Audit session not found");
    err.code = "AUDIT_NOT_FOUND";
    throw err;
  }
  if (!assertCanAccessSession(session, user)) {
    const err = new Error("Not authorized");
    err.code = "AUDIT_FORBIDDEN";
    throw err;
  }

  const now = new Date();
  const status = session.status;

  switch (action) {
    case "start":
      if (!["draft", "paused"].includes(status)) {
        const err = new Error("Only draft or paused audits can be started");
        err.code = "AUDIT_INVALID_STATE";
        throw err;
      }
      session.status = "in_progress";
      if (!session.startedAt) session.startedAt = now;
      session.pausedAt = null;
      break;
    case "pause":
      if (status !== "in_progress") {
        const err = new Error("Only in-progress audits can be paused");
        err.code = "AUDIT_INVALID_STATE";
        throw err;
      }
      session.status = "paused";
      session.pausedAt = now;
      break;
    case "resume":
      if (status !== "paused") {
        const err = new Error("Only paused audits can be resumed");
        err.code = "AUDIT_INVALID_STATE";
        throw err;
      }
      session.status = "in_progress";
      session.pausedAt = null;
      break;
    case "complete":
      if (!["in_progress", "paused"].includes(status)) {
        const err = new Error("Only active audits can be completed");
        err.code = "AUDIT_INVALID_STATE";
        throw err;
      }
      session.status = "completed";
      session.completedAt = now;
      // Future: set approval.status = 'pending' when apply-workflow ships.
      session.approval = session.approval || {};
      session.approval.status = "not_required";
      session.approval.appliedToInventory = false;
      break;
    case "cancel":
      if (!ACTIVE_STATUSES.includes(status)) {
        const err = new Error("Completed audits cannot be cancelled");
        err.code = "AUDIT_INVALID_STATE";
        throw err;
      }
      session.status = "cancelled";
      session.cancelledAt = now;
      break;
    default: {
      const err = new Error("Unknown audit action");
      err.code = "AUDIT_VALIDATION";
      throw err;
    }
  }

  await session.save();
  return serializeSession(session);
}

/**
 * Scan barcode during an in-progress audit.
 * Increments countedQty by 1. Snapshots expectedQty on first scan only.
 * NEVER updates live inventory.
 */
export async function scanAuditBarcode(user, sessionId, rawBarcode) {
  const session = await StockAuditSession.findById(sessionId);
  if (!session) {
    const err = new Error("Audit session not found");
    err.code = "AUDIT_NOT_FOUND";
    throw err;
  }
  if (!assertCanAccessSession(session, user)) {
    const err = new Error("Not authorized");
    err.code = "AUDIT_FORBIDDEN";
    throw err;
  }
  if (session.status !== "in_progress") {
    const err = new Error("Start or resume the audit before scanning");
    err.code = "AUDIT_INVALID_STATE";
    throw err;
  }

  const role = String(user.role || "").toLowerCase();
  const resolved = await resolveBarcodeForAudit(rawBarcode, {
    role,
    sellerId:
      role === "seller"
        ? user.id
        : session.locationType === "seller_store"
          ? session.sellerId
          : null,
    locationType: session.locationType,
  });

  const barcodeValue = resolved.barcodeValue;
  const now = new Date();
  let line = session.lines.find(
    (l) => String(l.barcodeValue) === String(barcodeValue),
  );

  if (line) {
    line.countedQty = Math.max(0, Number(line.countedQty) || 0) + 1;
    line.lastScannedAt = now;
  } else {
    session.lines.push({
      barcodeValue,
      productId: resolved.productId,
      variantId: resolved.variantId,
      productName: resolved.productName,
      variantName: resolved.variantName,
      unit: resolved.unit,
      expectedQty: resolved.expectedQty,
      countedQty: 1,
      firstScannedAt: now,
      lastScannedAt: now,
    });
    line = session.lines[session.lines.length - 1];
  }

  session.markModified("lines");
  await session.save();

  const serialized = serializeSession(session);
  const updatedLine = serialized.lines.find(
    (l) => String(l.barcodeValue) === String(barcodeValue),
  );

  return {
    session: serialized,
    line: updatedLine,
    // Hard guarantee for clients / future audits.
    inventoryUpdated: false,
  };
}

export function buildAuditReportRows(sessionPlain) {
  const lines = sessionPlain?.lines || [];
  return lines.map((line) => {
    const expected = Math.max(0, Number(line.expectedQty) || 0);
    const counted = Math.max(0, Number(line.countedQty) || 0);
    const difference = counted - expected;
    let status = "Matched";
    if (difference < 0) status = "Short";
    else if (difference > 0) status = "Over";
    return {
      product: line.productName || "",
      variant: line.variantName || "",
      barcode: line.barcodeValue || "",
      expectedQty: expected,
      countedQty: counted,
      difference,
      status,
    };
  });
}
