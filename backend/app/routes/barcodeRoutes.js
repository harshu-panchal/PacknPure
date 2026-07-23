import express from "express";
import {
  downloadBarcodePdf,
  ensureBarcodes,
  ensureMissingBarcodes,
  getBarcodeCatalog,
  getBarcodeCatalogBrands,
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

// Catalog / management (before :productId routes)
router.get("/catalog", getBarcodeCatalog);
router.get("/catalog/brands", getBarcodeCatalogBrands);
router.post("/ensure-missing", ensureMissingBarcodes);

router.get("/products/:productId", getProductBarcodes);
router.post("/products/:productId/ensure", ensureBarcodes);
router.get("/products/:productId/pdf", downloadBarcodePdf);
router.get("/preview/:barcodeValue", previewBarcodePng);

export default router;
