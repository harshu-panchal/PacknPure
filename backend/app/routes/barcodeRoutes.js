import express from "express";
import {
  downloadBarcodePdf,
  ensureBarcodes,
  getProductBarcodes,
  previewBarcodePng,
} from "../controller/barcodeController.js";
import {
  allowRoles,
  isAccountVerified,
  verifyToken,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken, allowRoles("admin", "seller"), isAccountVerified);

router.get("/products/:productId", getProductBarcodes);
router.post("/products/:productId/ensure", ensureBarcodes);
router.get("/products/:productId/pdf", downloadBarcodePdf);
router.get("/preview/:barcodeValue", previewBarcodePng);

export default router;
