import HubInventory from "../models/hubInventory.js";
import HubInward from "../models/hubInward.js";
import PurchaseRequest from "../models/purchaseRequest.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import handleResponse from "../utils/helper.js";
import {
  addHubAvailableStock,
  adjustHubAvailableStock,
  setAdminHubStock,
} from "../services/inventory/inventoryEngine.js";
import { getSellerVariantAvailableQty, buildCanonicalStockContext } from "../services/inventoryReadService.js";
import { normalizeVariantMatchKey } from "../utils/productHelpers.js";
import {
  totalVariantStock,
  resolveVariantIndex,
  setVariantStockAtIndex,
  listVariantsForStockPicker,
  variantStockRequiresSelection,
  applyAdminPricingFromStockPayload,
  effectiveSellingPrice,
} from "../utils/productHelpers.js";

const DEFAULT_HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";
const DEFAULT_MARGIN_TYPE = String(
  process.env.DEFAULT_PROCUREMENT_MARGIN_TYPE || "percent",
).toLowerCase() === "flat"
  ? "flat"
  : "percent";
const DEFAULT_MARGIN_VALUE = Math.max(
  0,
  Number(process.env.DEFAULT_PROCUREMENT_MARGIN_VALUE || 15),
);
const toMoney = (value) => Math.max(0, Number(Number(value || 0).toFixed(2)));
const resolveMarginType = (value) =>
  String(value || "").toLowerCase() === "flat" ? "flat" : "percent";
const resolveMarginValue = (value) => Math.max(0, Number(value || 0));
const computeSellPrice = (cost, marginType, marginValue) => {
  const base = Math.max(0, Number(cost || 0));
  if (resolveMarginType(marginType) === "flat") {
    return toMoney(base + resolveMarginValue(marginValue));
  }
  return toMoney(base + (base * resolveMarginValue(marginValue)) / 100);
};

const normalizeStatus = (availableQty, reorderLevel) => {
  if (availableQty <= 0) return "out_of_stock";
  if (availableQty <= reorderLevel) return "low_stock";
  return "healthy";
};

const statusLabel = (status) => {
  if (status === "low_stock") return "Low Stock";
  if (status === "out_of_stock") return "Out of Stock";
  return "Healthy";
};

const toQty = (value) => Math.max(0, Number(value || 0));
const keyOf = (productId, variantId) => `${String(productId)}::${String(variantId || "root")}`;
const ACTIVE_TRANSIT_PR_STATUSES = ["picked", "hub_delivered", "received_at_hub"];

export const getHubInventory = async (req, res) => {
  try {
    const hubId = String(req.query.hubId || DEFAULT_HUB_ID);
    const search = String(req.query.search || "").trim().toLowerCase();
    const sellerIdFilter = String(req.query.sellerId || "").trim();
    const productIdFilter = String(req.query.productId || "").trim();
    const variantIdFilter = String(req.query.variantId || "").trim();
    const filterType = String(req.query.filter || "").trim().toLowerCase();
    const rows = await HubInventory.find({ hubId }).sort({ updatedAt: -1 }).lean();

    const productIds = rows.map((r) => r.productId).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } })
      .select("name mainImage categoryId sellerId variants unit stock")
      .populate("categoryId", "name")
      .populate("sellerId", "shopName name")
      .lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));
    const productIdStrs = products.map((p) => String(p._id));

    let canonicalProductViews = new Map();
    try {
      const canonicalCtx = await buildCanonicalStockContext(productIdStrs);
      canonicalProductViews = canonicalCtx.productViews;
    } catch (err) {
      console.warn("[getHubInventory] canonical stock context:", err.message);
    }

    const sellerListings = await Product.find({
      ownerType: "seller",
      status: "active",
      masterProductId: { $in: productIds },
    })
      .select("_id sellerId masterProductId variants")
      .populate("sellerId", "shopName name")
      .lean();

    const productToSellerListings = new Map();
    for (const listing of sellerListings) {
      const k = String(listing.masterProductId || "");
      if (!productToSellerListings.has(k)) productToSellerListings.set(k, []);
      productToSellerListings.get(k).push(listing);
    }

    const [prs, inwards, orders] = await Promise.all([
      PurchaseRequest.find({
        hubId,
        status: { $in: ACTIVE_TRANSIT_PR_STATUSES },
        "items.productId": { $in: productIds },
      })
        .select("status items receivedAtHubAt")
        .lean(),
      HubInward.find({ hubId })
        .select("purchaseRequestId verificationStatus receivedItems")
        .lean(),
      Order.find({
        hubId,
        "items.product": { $in: productIds },
        status: { $nin: ["cancelled", "voided"] },
      })
        .select("items status workflowStatus")
        .lean(),
    ]);

    const inwardByPrId = new Map(inwards.map((row) => [String(row.purchaseRequestId), row]));

    const orderVariantMetrics = new Map();
    for (const ord of orders) {
      for (const line of ord.items || []) {
        if (!line?.variantId) continue;
        const k = keyOf(line.product, line.variantId);
        const prev = orderVariantMetrics.get(k) || {
          hr: 0,
          qaAccepted: 0,
          qaRejected: 0,
          delivered: 0,
          returned: 0,
        };
        prev.hr += toQty(line.hubReservedQty);
        prev.qaAccepted += toQty(line.qaAcceptedQty);
        prev.qaRejected += toQty(line.qaRejectedQty);
        prev.delivered += toQty(line.deliveredQty);
        prev.returned += toQty(line.returnedQty);
        orderVariantMetrics.set(k, prev);
      }
    }

    const prTransitByVariant = new Map();
    for (const pr of prs) {
      for (const line of pr.items || []) {
        if (!line?.variantId) continue;
        const k = keyOf(line.productId, line.variantId);
        const prev = prTransitByVariant.get(k) || {
          transit: 0,
          qaPending: 0,
        };
        const transitQty =
          toQty(line.actualPickedQty) ||
          toQty(line.committedQty) ||
          toQty(line.shortageQty);
        if (pr.status === "picked" || pr.status === "hub_delivered") {
          prev.transit += transitQty;
        }
        if (pr.status === "received_at_hub") {
          const inward = inwardByPrId.get(String(pr._id));
          if (inward?.verificationStatus === "pending") {
            const pendingQty = (inward.receivedItems || [])
              .filter((it) => String(it.productId) === String(line.productId))
              .reduce((sum, it) => sum + toQty(it.acceptedQty), 0);
            prev.qaPending += pendingQty;
          }
        }
        prTransitByVariant.set(k, prev);
      }
    }

    const mappedRows = rows.map((row) => {
      const product = productMap.get(String(row.productId));
      const availableQty = Number(row.availableQty || 0);
      const reorderLevel = Number(row.reorderLevel || 0);
      const computed = normalizeStatus(availableQty, reorderLevel);
      const variants = listVariantsForStockPicker(product || { variants: [] });
      const sellerRows = productToSellerListings.get(String(row.productId)) || [];

      const canonicalView = canonicalProductViews.get(String(row.productId));

      const variantInventory = variants.map((v) => {
        const metricKey = keyOf(row.productId, v.variantId);
        const orderMetric = orderVariantMetrics.get(metricKey) || {};
        const transitMetric = prTransitByVariant.get(metricKey) || {};
        const canonicalVariant = canonicalView?.variantByKey?.get(normalizeVariantMatchKey(v.name));

        let sellerAvailable = 0;
        let sc = 0;
        for (const sellerListing of sellerRows) {
          const variantStock = getSellerVariantAvailableQty(
            sellerListing,
            v.variantId,
            v.name,
          );
          sellerAvailable += variantStock.availableQty;
          sc += variantStock.committedStock;
        }

        const ha = canonicalVariant?.stock ?? toQty(v.stock);
        const availableQtyHub = canonicalVariant?.availableQtyHub ?? ha;
        const availableQtySeller = canonicalVariant?.availableQtySeller ?? sellerAvailable;
        const totalAvailableQty = canonicalVariant?.totalAvailableQty ?? (availableQtyHub + availableQtySeller);
        const hr = toQty(orderMetric.hr);
        const qaPending = toQty(transitMetric.qaPending);
        const qaAccepted = toQty(orderMetric.qaAccepted);
        const qaRejected = toQty(orderMetric.qaRejected);
        const delivered = toQty(orderMetric.delivered);
        const returned = toQty(orderMetric.returned);
        const transit = toQty(transitMetric.transit);

        return {
          variantId: v.variantId,
          index: v.index,
          name: v.name,
          unit: v.unit,
          stock: ha,
          availableQtyHub,
          availableQtySeller,
          totalAvailableQty,
          totalFulfillmentQty: totalAvailableQty,
          sellerSupplyBreakdown: canonicalVariant?.sellerSupplyBreakdown || [],
          ha,
          hr,
          sa: sellerAvailable,
          sc,
          transit,
          qaPending,
          qaAccepted,
          qaRejected,
          delivered,
          returned,
        };
      });

      const variantTotals = variantInventory.reduce(
        (acc, v) => ({
          ha: acc.ha + v.ha,
          hr: acc.hr + v.hr,
          sa: acc.sa + v.sa,
          sc: acc.sc + v.sc,
          transit: acc.transit + v.transit,
          qaPending: acc.qaPending + v.qaPending,
          qaAccepted: acc.qaAccepted + v.qaAccepted,
          qaRejected: acc.qaRejected + v.qaRejected,
          delivered: acc.delivered + v.delivered,
          returned: acc.returned + v.returned,
        }),
        {
          ha: 0,
          hr: 0,
          sa: 0,
          sc: 0,
          transit: 0,
          qaPending: 0,
          qaAccepted: 0,
          qaRejected: 0,
          delivered: 0,
          returned: 0,
        },
      );

      return {
        _id: row._id,
        hubId: row.hubId,
        productId: row.productId,
        productName: product?.name || "Unknown Product",
        imageUrl: product?.mainImage || "",
        category: product?.categoryId?.name || "N/A",
        sellerId: product?.sellerId?._id || product?.sellerId || null,
        sellerName: product?.sellerId?.shopName || product?.sellerId?.name || "N/A",
        hubStockQuantity: availableQty,
        stock: canonicalView?.stock ?? availableQty,
        availableQtyHub: canonicalView?.availableQtyHub ?? availableQty,
        availableQtySeller: canonicalView?.availableQtySeller ?? variantTotals.sa,
        totalAvailableQty: canonicalView?.totalAvailableQty ?? (availableQty + variantTotals.sa),
        totalFulfillmentQty: canonicalView?.totalFulfillmentQty ?? (availableQty + variantTotals.sa),
        sellerSupplyBreakdown: canonicalView?.sellerSupplyBreakdown || [],
        reservedQty: Number(row.reservedQty || 0),
        minimumStockAlert: reorderLevel,
        lastPurchaseCost: Number(row.lastPurchaseCost || 0),
        avgPurchaseCost: Number(row.avgPurchaseCost || 0),
        marginType: row.marginType || DEFAULT_MARGIN_TYPE,
        marginValue: Number(
          row.marginValue !== undefined ? row.marginValue : DEFAULT_MARGIN_VALUE,
        ),
        sellPrice: Number(row.sellPrice || 0),
        status: computed,
        statusLabel: statusLabel(computed),
        updatedAt: row.updatedAt,
        hasVariants: Array.isArray(product?.variants) && product.variants.length > 0,
        variants,
        variantInventory,
        variantTotals,
        variantCount: product?.variants?.length || 0,
      };
    });

    const filtered = mappedRows.filter((row) => {
      if (productIdFilter && String(row.productId) !== productIdFilter) return false;
      if (sellerIdFilter && String(row.sellerId || "") !== sellerIdFilter) return false;
      if (search) {
        const productText = String(row.productName || "").toLowerCase();
        const sellerText = String(row.sellerName || "").toLowerCase();
        const variantText = (row.variantInventory || [])
          .map((v) => String(v.name || "").toLowerCase())
          .join(" ");
        if (!productText.includes(search) && !sellerText.includes(search) && !variantText.includes(search)) {
          return false;
        }
      }

      if (variantIdFilter) {
        const found = (row.variantInventory || []).some((v) => String(v.variantId || "") === variantIdFilter);
        if (!found) return false;
      }

      if (filterType === "low_stock") return String(row.status) === "low_stock" || String(row.status) === "out_of_stock";
      if (filterType === "reserved") return toQty(row.variantTotals?.hr) > 0;
      if (filterType === "committed") return toQty(row.variantTotals?.sc) > 0;
      if (filterType === "transit") return toQty(row.variantTotals?.transit) > 0;
      if (filterType === "qa_pending") return toQty(row.variantTotals?.qaPending) > 0;

      return true;
    });

    const totals = filtered.reduce(
      (acc, row) => ({
        totalHubAvailable: acc.totalHubAvailable + toQty(row.variantTotals?.ha),
        totalHubReserved: acc.totalHubReserved + toQty(row.variantTotals?.hr),
        totalSellerAvailable: acc.totalSellerAvailable + toQty(row.variantTotals?.sa),
        totalSellerCommitted: acc.totalSellerCommitted + toQty(row.variantTotals?.sc),
      }),
      {
        totalHubAvailable: 0,
        totalHubReserved: 0,
        totalSellerAvailable: 0,
        totalSellerCommitted: 0,
      },
    );

    return handleResponse(res, 200, "Hub inventory fetched", { items: filtered, totals });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// SOP style: Add stock by selecting existing catalog product.
export const upsertHubInventory = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      minimumStockAlert,
      hubId,
      marginType,
      marginValue,
      sellPrice,
      purchaseCost,
      variantId,
      variantIndex,
      variantName,
    } = req.body;

    if (!productId) {
      return handleResponse(res, 400, "productId is required");
    }

    const product = await Product.findById(productId).select(
      "_id price salePrice purchasePrice masterProductId ownerType variants stock unit lowStockAlert",
    );
    if (!product) {
      return handleResponse(res, 404, "Product not found");
    }

    // --- HUB-FIRST LOGIC: Resolve Master ID for Inventory ---
    const resolvedMasterProductId = (product.ownerType === 'seller' && product.masterProductId) 
      ? String(product.masterProductId) 
      : String(product._id);

    const qty = Math.max(0, Number(quantity || 0));
    const isStockAdd = qty > 0;
    const minAlert = Math.max(0, Number(minimumStockAlert || 0));
    const normalizedMarginType = resolveMarginType(marginType || DEFAULT_MARGIN_TYPE);
    const normalizedMarginValue = resolveMarginValue(
      marginValue !== undefined ? marginValue : DEFAULT_MARGIN_VALUE,
    );
    const finalHubId = String(hubId || DEFAULT_HUB_ID);
    const catalogProduct = await Product.findById(resolvedMasterProductId);

    let resolvedVariantId = null;
    if (isStockAdd && catalogProduct && variantStockRequiresSelection(catalogProduct)) {
      const idx = resolveVariantIndex(catalogProduct, { variantId, variantIndex, variantName });
      if (idx === -2) {
        return handleResponse(
          res,
          400,
          "This product has variants. Select variantId or variantIndex to add stock.",
          {
            requiresVariant: true,
            variants: listVariantsForStockPicker(catalogProduct),
          },
        );
      }
      if (idx < 0) {
        return handleResponse(res, 400, "Variant not found", {
          variants: listVariantsForStockPicker(catalogProduct),
        });
      }
      resolvedVariantId = catalogProduct.variants[idx]?._id || null;
    }

    let row = await HubInventory.findOne({ hubId: finalHubId, productId: resolvedMasterProductId });
    if (!row) {
      const seededCost = toMoney(
        purchaseCost !== undefined
          ? purchaseCost
          : Number(product?.salePrice || 0) > 0 &&
              Number(product?.salePrice || 0) < Number(product?.price || 0)
            ? product.salePrice
            : product?.price || 0,
      );
      const initialHubQty = Math.max(0, Number(totalVariantStock(catalogProduct?.variants || []) || 0)) + qty;

      row = new HubInventory({
        hubId: finalHubId,
        productId: resolvedMasterProductId,
        availableQty: 0,
        reservedQty: 0,
        reorderLevel: minAlert,
        lastPurchaseCost: seededCost,
        avgPurchaseCost: seededCost,
        marginType: normalizedMarginType,
        marginValue: normalizedMarginValue,
        sellPrice:
          sellPrice !== undefined
            ? toMoney(sellPrice)
            : computeSellPrice(seededCost, normalizedMarginType, normalizedMarginValue),
        priceUpdatedAt: new Date(),
      });
      await row.save();

      if (initialHubQty > 0) {
        await setAdminHubStock({
          productId: resolvedMasterProductId,
          quantity: initialHubQty,
          hubId: finalHubId,
          reorderLevel: minAlert,
          reason: "hub_inventory_upsert_initial",
        });
        row = await HubInventory.findOne({ hubId: finalHubId, productId: resolvedMasterProductId });
      }
    } else {
      if (isStockAdd) {
        await addHubAvailableStock({
          productId: resolvedMasterProductId,
          variantId: resolvedVariantId,
          quantity: qty,
          hubId: finalHubId,
          reason: "hub_inventory_upsert_add",
        });
        row = await HubInventory.findOne({ hubId: finalHubId, productId: resolvedMasterProductId });
      }
      if (minimumStockAlert !== undefined) {
        row.reorderLevel = minAlert;
      }
      if (purchaseCost !== undefined) {
        const nextCost = toMoney(purchaseCost);
        row.lastPurchaseCost = nextCost;
        row.avgPurchaseCost = nextCost;
      }
      if (marginType !== undefined) {
        row.marginType = normalizedMarginType;
      }
      if (marginValue !== undefined) {
        row.marginValue = normalizedMarginValue;
      }
      if (sellPrice !== undefined) {
        row.sellPrice = toMoney(sellPrice);
      } else if (marginType !== undefined || marginValue !== undefined || purchaseCost !== undefined) {
        const costBase = Number(row.avgPurchaseCost || row.lastPurchaseCost || 0);
        row.sellPrice = computeSellPrice(costBase, row.marginType, row.marginValue);
      }
      if (
        marginType !== undefined ||
        marginValue !== undefined ||
        sellPrice !== undefined ||
        purchaseCost !== undefined
      ) {
        row.priceUpdatedAt = new Date();
      }
    }

    row.status = normalizeStatus(Number(row.availableQty || 0), Number(row.reorderLevel || 0));
    await row.save();

    // Fetch the updated product to return in the payload
    const updatedProduct = await Product.findById(resolvedMasterProductId);

    const responsePayload = {
      ...row.toObject(),
      catalogStock: totalVariantStock(updatedProduct?.variants || []),
      variants: catalogProduct ? listVariantsForStockPicker(catalogProduct) : [],
    };

    return handleResponse(res, 200, "Hub inventory upserted", responsePayload);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const adjustHubInventoryStock = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      delta,
      variantId,
      variantIndex,
      variantName,
      price,
      salePrice,
      purchasePrice,
      mrp,
    } = req.body;
    const numericDelta = Number(delta || 0);
    if (!Number.isFinite(numericDelta) || numericDelta === 0) {
      return handleResponse(res, 400, "delta must be a non-zero number");
    }

    const row = await HubInventory.findById(id);
    if (!row) return handleResponse(res, 404, "Hub inventory row not found");

    const product = await Product.findById(row.productId);
    if (!product) {
      return handleResponse(res, 404, "Linked catalog product not found");
    }

    if (variantStockRequiresSelection(product)) {
      const idx = resolveVariantIndex(product, { variantId, variantIndex, variantName });
      if (idx === -2) {
        return handleResponse(
          res,
          400,
          "This product has variants. Select which variant to update (variantId or variantIndex).",
          {
            requiresVariant: true,
            variants: listVariantsForStockPicker(product),
          },
        );
      }
      if (idx < 0) {
        return handleResponse(res, 400, "Variant not found", {
          variants: listVariantsForStockPicker(product),
        });
      }

      const resolvedVariantId = product.variants[idx]?._id || null;

      await adjustHubAvailableStock({
        productId: product._id,
        variantId: resolvedVariantId,
        delta: numericDelta,
        hubId: row.hubId || DEFAULT_HUB_ID,
        reason: "hub_inventory_adjust_variant",
      });

      const updatedRow = await HubInventory.findById(id);
      const updatedProduct = await Product.findById(product._id);
      return handleResponse(res, 200, "Variant hub stock updated", {
        ...updatedRow.toObject(),
        catalogStock: totalVariantStock(updatedProduct?.variants || []),
        variant: {
          variantId: resolvedVariantId,
          index: idx,
          name: updatedProduct.variants[idx]?.name,
          stock: updatedProduct.variants[idx]?.stock,
        },
        variants: listVariantsForStockPicker(updatedProduct),
      });
    }

    await adjustHubAvailableStock({
      productId: product._id,
      variantId: null,
      delta: numericDelta,
      hubId: row.hubId || DEFAULT_HUB_ID,
      reason: "hub_inventory_adjust",
    });

    const updatedRow = await HubInventory.findById(id);
    const updatedProduct = await Product.findById(product._id);
    return handleResponse(res, 200, "Hub stock updated", {
      ...updatedRow.toObject(),
      catalogStock: totalVariantStock(updatedProduct?.variants || []),
      variants: [],
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateHubInventoryReorderLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { reorderLevel } = req.body;
    const minAlert = Math.max(0, Number(reorderLevel || 0));

    const row = await HubInventory.findById(id);
    if (!row) return handleResponse(res, 404, "Hub inventory row not found");

    row.reorderLevel = minAlert;
    row.status = normalizeStatus(Number(row.availableQty || 0), minAlert);
    await row.save();

    return handleResponse(res, 200, "Minimum stock alert updated", row);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const deleteHubInventory = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedRow = await HubInventory.findByIdAndDelete(id);
    if (!deletedRow) {
      return handleResponse(res, 404, "Hub inventory row not found");
    }

    return handleResponse(res, 200, "Hub inventory item removed successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
