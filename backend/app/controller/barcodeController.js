import Product from "../models/product.js";
import handleResponse from "../utils/helper.js";
import {
  collectBarcodeLabelRows,
  ensureProductBarcodes,
  ensureProductBarcodesSafe,
} from "../services/barcode/barcodeService.js";
import {
  buildBarcodeLabelsPdf,
  renderCode128Png,
} from "../services/barcode/barcodePdfService.js";
import {
  ensureMissingBarcodesForScope,
  listBarcodeCatalog,
  listBarcodeCatalogBrands,
} from "../services/barcode/barcodeCatalogService.js";

function canAccessProduct(product, user) {
  if (!product || !user) return false;
  const role = String(user.role || "").toLowerCase();
  if (role === "admin") return true;
  if (role === "seller") {
    return (
      product.ownerType === "seller" &&
      String(product.sellerId) === String(user.id)
    );
  }
  return false;
}

/**
 * GET /api/barcodes/catalog
 * Paginated sticker rows for barcode management UI.
 * Seller: own listings only. Admin: master catalog (or ownerType filter).
 */
export const getBarcodeCatalog = async (req, res) => {
  try {
    const result = await listBarcodeCatalog(req.user, req.query);
    return handleResponse(res, 200, "Barcode catalog fetched", result);
  } catch (error) {
    return handleResponse(res, 500, error.message || "Failed to load barcode catalog");
  }
};

/**
 * GET /api/barcodes/catalog/brands
 * Distinct brands for filter dropdown.
 */
export const getBarcodeCatalogBrands = async (req, res) => {
  try {
    const brands = await listBarcodeCatalogBrands(req.user);
    return handleResponse(res, 200, "Brands fetched", { brands });
  } catch (error) {
    return handleResponse(res, 500, error.message || "Failed to load brands");
  }
};

/**
 * POST /api/barcodes/ensure-missing
 * Generate barcodes only where missing. Never regenerates existing.
 * Body: { productIds?: string[], ownerType?: "admin"|"seller", limit?: number }
 */
export const ensureMissingBarcodes = async (req, res) => {
  try {
    const result = await ensureMissingBarcodesForScope(req.user, {
      productIds: req.body?.productIds,
      ownerType: req.body?.ownerType,
      limit: req.body?.limit,
    });
    return handleResponse(res, 200, "Missing barcodes ensured", result);
  } catch (error) {
    return handleResponse(
      res,
      500,
      error.message || "Failed to generate missing barcodes",
    );
  }
};

/**
 * GET /api/barcodes/products/:productId
 * List barcode identities for a product (no regeneration).
 */
export const getProductBarcodes = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId).select(
      "name ownerType sellerId variants",
    );
    if (!product) return handleResponse(res, 404, "Product not found");
    if (!canAccessProduct(product, req.user)) {
      return handleResponse(res, 403, "Not authorized to view these barcodes");
    }

    const labels = collectBarcodeLabelRows(product);
    return handleResponse(res, 200, "Barcodes fetched", {
      productId: product._id,
      productName: product.name,
      ownerType: product.ownerType,
      barcodes: labels,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * POST /api/barcodes/products/:productId/ensure
 * Generate missing barcodes only (safe retry). Never regenerates existing.
 */
export const ensureBarcodes = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId).select(
      "name ownerType sellerId variants",
    );
    if (!product) return handleResponse(res, 404, "Product not found");
    if (!canAccessProduct(product, req.user)) {
      return handleResponse(res, 403, "Not authorized to generate barcodes");
    }

    const result = await ensureProductBarcodes(productId);
    const labels = collectBarcodeLabelRows(result.product || product);

    return handleResponse(res, 200, "Barcodes ensured", {
      productId,
      generated: result.generated,
      skipped: result.skipped,
      barcodes: labels,
    });
  } catch (error) {
    return handleResponse(
      res,
      500,
      error.message || "Barcode generation failed. You can retry safely.",
    );
  }
};

/**
 * GET /api/barcodes/products/:productId/pdf
 * Download printable PDF of all (or newly created seller) barcodes.
 *
 * Query:
 *  - newlyCreatedOnly=true
 *  - since=ISO date
 *  - variantIds=id1,id2
 */
export const downloadBarcodePdf = async (req, res) => {
  try {
    const { productId } = req.params;
    const newlyCreatedOnly =
      req.query.newlyCreatedOnly === "true" ||
      req.query.newlyCreatedOnly === "1";

    let product = await Product.findById(productId);
    if (!product) return handleResponse(res, 404, "Product not found");
    if (!canAccessProduct(product, req.user)) {
      return handleResponse(res, 403, "Not authorized to download barcodes");
    }

    const ensured = await ensureProductBarcodesSafe(productId);
    if (ensured?.product) product = ensured.product;
    else product = await Product.findById(productId);

    const variantIds = req.query.variantIds
      ? String(req.query.variantIds)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    let since = req.query.since ? new Date(req.query.since) : null;
    if (newlyCreatedOnly && !since && !variantIds?.length) {
      since = new Date(Date.now() - 60 * 60 * 1000);
    }

    const labels = collectBarcodeLabelRows(product, {
      newlyCreatedOnly:
        newlyCreatedOnly && product.ownerType === "seller",
      since,
      variantIds,
    });

    if (!labels.length) {
      return handleResponse(
        res,
        404,
        newlyCreatedOnly
          ? "No newly created seller barcodes found for this product"
          : "No barcodes found for this product",
      );
    }

    const pdfBytes = await buildBarcodeLabelsPdf(labels);
    const safeName = String(product.name || "product")
      .replace(/[^a-z0-9-_]+/gi, "_")
      .slice(0, 40);
    const filename = `barcodes_${safeName}_${productId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.setHeader("Content-Length", pdfBytes.length);
    return res.status(200).send(Buffer.from(pdfBytes));
  } catch (error) {
    return handleResponse(res, 500, error.message || "Failed to build barcode PDF");
  }
};

/**
 * GET /api/barcodes/preview/:barcodeValue
 * PNG preview (owner must own a matching variant).
 */
export const previewBarcodePng = async (req, res) => {
  try {
    const barcodeValue = String(req.params.barcodeValue || "").trim();
    if (!barcodeValue) {
      return handleResponse(res, 400, "barcodeValue is required");
    }

    const role = String(req.user?.role || "").toLowerCase();
    const query =
      role === "admin"
        ? {
            $or: [
              { "variants.barcodeValue": barcodeValue },
              { "variants.sellerBarcodeValue": barcodeValue },
            ],
          }
        : {
            ownerType: "seller",
            sellerId: req.user.id,
            "variants.sellerBarcodeValue": barcodeValue,
          };

    const product = await Product.findOne(query).select("_id");
    if (!product) {
      return handleResponse(res, 404, "Barcode not found");
    }

    const png = await renderCode128Png(barcodeValue);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=86400");
    return res.status(200).send(png);
  } catch (error) {
    return handleResponse(res, 500, error.message || "Failed to render barcode");
  }
};
