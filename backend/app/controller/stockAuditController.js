import handleResponse from "../utils/helper.js";
import {
  buildAuditReportRows,
  createAuditSession,
  getAuditSession,
  listAuditSessions,
  scanAuditBarcode,
  transitionAuditStatus,
} from "../services/stockAudit/stockAuditService.js";

function mapAuditError(res, error) {
  const code = error?.code || "";
  if (code === "AUDIT_NOT_FOUND") return handleResponse(res, 404, error.message);
  if (code === "AUDIT_FORBIDDEN") return handleResponse(res, 403, error.message);
  if (
    code === "AUDIT_VALIDATION" ||
    code === "AUDIT_INVALID_STATE" ||
    code === "AUDIT_INVALID_BARCODE" ||
    code === "AUDIT_INACTIVE"
  ) {
    return handleResponse(res, 400, error.message);
  }
  return handleResponse(res, 500, error.message || "Stock audit error");
}

/** POST /api/stock-audits */
export const createStockAudit = async (req, res) => {
  try {
    const session = await createAuditSession(req.user, req.body || {});
    return handleResponse(res, 201, "Audit session created", session);
  } catch (error) {
    return mapAuditError(res, error);
  }
};

/** GET /api/stock-audits */
export const listStockAudits = async (req, res) => {
  try {
    const result = await listAuditSessions(req.user, req.query);
    return handleResponse(res, 200, "Audit sessions fetched", result);
  } catch (error) {
    return mapAuditError(res, error);
  }
};

/** GET /api/stock-audits/:id */
export const getStockAudit = async (req, res) => {
  try {
    const session = await getAuditSession(req.user, req.params.id);
    return handleResponse(res, 200, "Audit session fetched", session);
  } catch (error) {
    return mapAuditError(res, error);
  }
};

/** POST /api/stock-audits/:id/start|pause|resume|complete|cancel */
export const transitionStockAudit = async (req, res) => {
  try {
    const action = String(req.params.action || "").toLowerCase();
    const session = await transitionAuditStatus(req.user, req.params.id, action);
    return handleResponse(res, 200, `Audit ${action} successful`, session);
  } catch (error) {
    return mapAuditError(res, error);
  }
};

/**
 * POST /api/stock-audits/:id/scan
 * Body: { barcode }
 * Increments count only — never updates inventory.
 */
export const scanStockAudit = async (req, res) => {
  try {
    const barcode = req.body?.barcode || req.body?.barcodeValue;
    if (!barcode) {
      return handleResponse(res, 400, "barcode is required");
    }
    const result = await scanAuditBarcode(req.user, req.params.id, barcode);
    return handleResponse(res, 200, "Scan recorded (inventory unchanged)", result);
  } catch (error) {
    return mapAuditError(res, error);
  }
};

/** GET /api/stock-audits/:id/report */
export const getStockAuditReport = async (req, res) => {
  try {
    const session = await getAuditSession(req.user, req.params.id);
    const rows = buildAuditReportRows(session);
    return handleResponse(res, 200, "Audit report", {
      session: {
        _id: session._id,
        sessionCode: session.sessionCode,
        status: session.status,
        locationType: session.locationType,
        locationLabel: session.locationLabel,
        summary: session.summary,
        completedAt: session.completedAt,
        inventoryMutations: false,
        approval: session.approval,
      },
      rows,
    });
  } catch (error) {
    return mapAuditError(res, error);
  }
};

/** GET /api/stock-audits/:id/export.csv */
export const exportStockAuditCsv = async (req, res) => {
  try {
    const session = await getAuditSession(req.user, req.params.id);
    const rows = buildAuditReportRows(session);
    const header = [
      "Product",
      "Variant",
      "Barcode",
      "Expected Qty",
      "Counted Qty",
      "Difference",
      "Status",
    ];
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          escape(r.product),
          escape(r.variant),
          escape(r.barcode),
          r.expectedQty,
          r.countedQty,
          r.difference,
          escape(r.status),
        ].join(","),
      ),
    ];
    const csv = `\uFEFF${lines.join("\n")}`;
    const filename = `stock_audit_${session.sessionCode || session._id}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (error) {
    return mapAuditError(res, error);
  }
};
