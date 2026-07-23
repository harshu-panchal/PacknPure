import express from "express";
import {
  createStockAudit,
  exportStockAuditCsv,
  getStockAudit,
  getStockAuditReport,
  listStockAudits,
  scanStockAudit,
  transitionStockAudit,
} from "../controller/stockAuditController.js";
import {
  allowRoles,
  isAccountVerified,
  verifyToken,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken, allowRoles("admin", "seller"), isAccountVerified);

router.post("/", createStockAudit);
router.get("/", listStockAudits);
router.get("/:id/report", getStockAuditReport);
router.get("/:id/export.csv", exportStockAuditCsv);
router.get("/:id", getStockAudit);
router.post("/:id/scan", scanStockAudit);

const withAction = (action) => (req, res) => {
  req.params.action = action;
  return transitionStockAudit(req, res);
};

router.post("/:id/start", withAction("start"));
router.post("/:id/pause", withAction("pause"));
router.post("/:id/resume", withAction("resume"));
router.post("/:id/complete", withAction("complete"));
router.post("/:id/cancel", withAction("cancel"));

export default router;
