import HubInventory from "../models/hubInventory.js";
import Product from "../models/product.js";
import PurchaseRequest from "../models/purchaseRequest.js";
import Seller from "../models/seller.js";
import {
  effectiveProductStock,
  normalizeVariantMatchKey,
  resolveSellerVariantIdSync,
  totalVariantCommitted,
} from "../utils/productHelpers.js";
import { distanceMeters } from "../utils/geoUtils.js";
import {
  ensureProcurementSession,
  reserveAllocation,
  attachPurchaseRequestAllocation,
  markAllocationTimeout,
  buildItemKey,
  getEligibleFallbackSellers,
} from "./procurementSessionService.js";
import { rankSellerAllocations } from "./allocationEngine.js";

const HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";
const DEFAULT_PROCUREMENT_MARGIN_TYPE = String(
  process.env.DEFAULT_PROCUREMENT_MARGIN_TYPE || "percent",
).toLowerCase() === "flat"
  ? "flat"
  : "percent";
const DEFAULT_PROCUREMENT_MARGIN_VALUE = Math.max(
  0,
  Number(process.env.DEFAULT_PROCUREMENT_MARGIN_VALUE || 15),
);

const buildRequestId = () =>
  `PR-${Date.now()}-${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;

export const HUB_ORDER_MODE = () =>
  String(process.env.HUB_FIRST_ORDER_ROUTING || "false").toLowerCase() === "true";

/** Physical seller variant stock (matches seller/admin portal UI). */
export function sellerProcurementCapacity(
  sellerProduct,
  masterVariantId,
  masterProduct,
) {
  if (!sellerProduct) return 0;

  let masterVariantName = null;
  if (masterVariantId && Array.isArray(masterProduct?.variants)) {
    const masterVar = masterProduct.variants.find(
      (v) => String(v._id || v.id) === String(masterVariantId),
    );
    masterVariantName = masterVar?.name
      ? normalizeVariantMatchKey(masterVar.name)
      : null;
  }

  if (masterVariantName && Array.isArray(sellerProduct.variants)) {
    const sellerVar = sellerProduct.variants.find(
      (v) => normalizeVariantMatchKey(v.name) === masterVariantName,
    );
    if (sellerVar) {
      return Math.max(0, Number(sellerVar.stock) || 0);
    }
  }

  if (Array.isArray(sellerProduct.variants) && sellerProduct.variants.length) {
    return sellerProduct.variants.reduce(
      (sum, v) => sum + Math.max(0, Number(v?.stock) || 0),
      0,
    );
  }

  return Math.max(0, Number(sellerProduct.stock) || 0);
}

/** Seller fulfillable qty for a master catalog variant (stock minus committed). */
export function sellerAvailableForMasterVariant(sellerProduct, masterVariantId, masterProduct) {
  if (!sellerProduct) return 0;

  let masterVariantName = null;
  if (masterVariantId && Array.isArray(masterProduct?.variants)) {
    const masterVar = masterProduct.variants.find(
      (v) => String(v._id || v.id) === String(masterVariantId),
    );
    masterVariantName = masterVar?.name
      ? normalizeVariantMatchKey(masterVar.name)
      : null;
  }

  if (masterVariantName && Array.isArray(sellerProduct.variants)) {
    const sellerVar = sellerProduct.variants.find(
      (v) => normalizeVariantMatchKey(v.name) === masterVariantName,
    );
    if (sellerVar) {
      return Math.max(
        0,
        (Number(sellerVar.stock) || 0) - (Number(sellerVar.committedStock) || 0),
      );
    }
  }

  if (Array.isArray(sellerProduct.variants) && sellerProduct.variants.length > 0) {
    return Math.max(
      0,
      effectiveProductStock(sellerProduct) - totalVariantCommitted(sellerProduct.variants),
    );
  }

  return Math.max(
    0,
    (Number(sellerProduct.stock) || 0) - (Number(sellerProduct.committedStock) || 0),
  );
}

async function commitSellerStockForPrLine({
  selectedSellerProductId,
  masterProduct,
  masterProductId = null,
  masterVariantId,
  quantity,
}) {
  if (!selectedSellerProductId || quantity <= 0) return;
  const { freezeSellerInventory } = await import("./inventoryLifecycleService.js");
  let sellerVariantId = null;
  if (masterVariantId) {
    let resolvedMaster = masterProduct;
    if (!resolvedMaster && masterProductId) {
      resolvedMaster = await Product.findById(masterProductId).select("variants").lean();
    }
    const sellerProduct = await Product.findById(selectedSellerProductId)
      .select("variants")
      .lean();
    sellerVariantId = resolveSellerVariantIdSync({
      masterProduct: resolvedMaster,
      sellerProduct,
      masterVariantId,
    });
  }
  await freezeSellerInventory(selectedSellerProductId, sellerVariantId, quantity);
}

/**
 * Build stock snapshot and shortages for an order's items.
 */
export const planHubFulfillment = async (orderItems, hubId = HUB_ID) => {
  const productIds = orderItems.map((item) => String(item.product));
  const [inventoryRows, products] = await Promise.all([
    HubInventory.find({ hubId, productId: { $in: productIds } }).lean(),
    Product.find({ _id: { $in: productIds } })
      .select("_id sellerId name categoryId subcategoryId ownerType price salePrice purchasePrice stock variants")
      .lean(),
  ]);

  const invMap = new Map(
    inventoryRows.map((row) => [String(row.productId), Math.max(0, Number(row.availableQty || 0))]),
  );
  const sellerMap = new Map(
    products.map((p) => [String(p._id), p?.sellerId ? String(p.sellerId) : null]),
  );
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const shortages = [];
  const allocations = [];

  for (const item of orderItems) {
    const productId = String(item.product);
    const requiredQty = Number(item.quantity || 0);
    const variantId = item.variantId || null;
    const baseProduct = productMap.get(productId) || null;
    if (Array.isArray(baseProduct?.variants) && baseProduct.variants.length > 0 && !variantId) {
      throw new Error(`Variant ID is required for product ${baseProduct?.name || productId}`);
    }
    
    const hubProductQty = Math.max(0, Number(invMap.get(productId) || 0));
    
    let variantMaxQty = hubProductQty;
    if (variantId && baseProduct && Array.isArray(baseProduct.variants)) {
      const v = baseProduct.variants.find(
        (v) => String(v._id) === String(variantId) || String(v.id) === String(variantId)
      );
      if (v) {
        variantMaxQty = Math.max(0, Number(v.stock) || 0);
      }
    }
    
    const availableQty = Math.min(hubProductQty, variantMaxQty);
    const reserveQty = Math.min(availableQty, requiredQty);
    const shortageQty = Math.max(0, requiredQty - reserveQty);
    
    // Update invMap in-memory so the next iteration
    // for the same product sees the already-allocated qty as consumed.
    // This prevents the same hub stock from being double-counted.
    if (reserveQty > 0) {
      invMap.set(productId, Math.max(0, hubProductQty - reserveQty));
      if (variantId && baseProduct && Array.isArray(baseProduct.variants)) {
        const v = baseProduct.variants.find(
          (v) => String(v._id) === String(variantId) || String(v.id) === String(variantId)
        );
        if (v) {
          v.stock = Math.max(0, (Number(v.stock) || 0) - reserveQty);
        }
      }
    }

    allocations.push({ productId, variantId, reserveQty });
    if (shortageQty > 0) {
      shortages.push({
        productId,
        variantId,
        requiredQty,
        availableQtyAtHub: availableQty,
        shortageQty,
        vendorId: sellerMap.get(productId) || null,
        baseProduct,
      });
    }
  }

  return {
    hubId,
    allocations,
    shortages,
    fullyAvailable: shortages.length === 0,
  };
};

/**
 * Reserve inventory rows for fully-available orders.
 * Returns false if any reserve check fails (race-safe).
 */
export const reserveHubInventory = async (allocations, hubId = HUB_ID) => {
  const { freezeHubInventory, releaseHubReservation } = await import("./inventoryLifecycleService.js");
  const reservedRows = [];
  for (const row of allocations) {
    if (!row.reserveQty || row.reserveQty <= 0) continue;
    const updated = await freezeHubInventory(row.productId, row.variantId, row.reserveQty);
    
    if (!updated) {
      // Roll back partial reservations when any line fails (race-safe best effort).
      for (const applied of reservedRows) {
         await releaseHubReservation(applied.productId, applied.variantId, applied.reserveQty);
      }
      return { ok: false, reservedRows: [] };
    }
    reservedRows.push({ productId: row.productId, variantId: row.variantId, reserveQty: row.reserveQty });
  }
  return { ok: true, reservedRows };
};

/**
 * Create procurement requests grouped by vendor for shortage items.
 */
export const createAutoPurchaseRequests = async ({
  order,
  shortages,
  hubId = HUB_ID,
  allowUnassigned = false,
}) => {
  const Setting = (await import("../models/setting.js")).default;
  const settings = await Setting.findOne().lean();
  const sellerResponseTimeout = settings?.sellerResponseTimeout || 15;
  const normalizeMoney = (value) => Math.max(0, Number(Number(value || 0).toFixed(2)));
  const effectiveCatalogPrice = (sellerProduct, masterVariantId = null, baseProduct = null) => {
    let sellerVar = null;
    if (masterVariantId && Array.isArray(baseProduct?.variants)) {
      const masterVar = baseProduct.variants.find(
        (v) => String(v._id || v.id) === String(masterVariantId)
      );
      if (masterVar?.name && Array.isArray(sellerProduct?.variants)) {
        const masterVariantName = normalizeVariantMatchKey(masterVar.name);
        sellerVar = sellerProduct.variants.find(
          (v) => normalizeVariantMatchKey(v.name) === masterVariantName
        );
      }
    }
    
    // Priority 1: Use matched variant price
    if (sellerVar) {
      const vCost = Number(sellerVar.purchasePrice || 0);
      if (vCost > 0) return vCost;
      const vSale = Number(sellerVar.salePrice || 0);
      const vMrp = Number(sellerVar.price || 0);
      return vSale > 0 && vSale < vMrp ? vSale : vMrp;
    }

    // Priority 2: If no variant match, use first variant if exists
    if (sellerProduct?.variants?.length > 0) {
      const v = sellerProduct.variants[0];
      const vCost = Number(v.purchasePrice || 0);
      if (vCost > 0) return vCost;
      const vSale = Number(v.salePrice || 0);
      const vMrp = Number(v.price || 0);
      return vSale > 0 && vSale < vMrp ? vSale : vMrp;
    }

    // Priority 3: Root price
    const cost = Number(sellerProduct?.purchasePrice || 0);
    if (cost > 0) return cost;
    const sale = Number(sellerProduct?.salePrice || 0);
    const base = Number(sellerProduct?.price || 0);
    return sale > 0 && sale < base ? sale : base;
  };
  const normalizeText = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();
  const sameCategory = (candidate, base) =>
    String(candidate?.categoryId || "") === String(base?.categoryId || "") &&
    String(candidate?.subcategoryId || "") === String(base?.subcategoryId || "");

  const selectCheapestSellers = async (
    baseProduct,
    shortageQty,
    hubLat,
    hubLng,
    variantId = null,
  ) => {
    return rankSellerAllocations({
      baseProduct,
      shortageQty,
      variantId,
      hubLat,
      hubLng,
      enableMultiSellerAllocation: Boolean(settings?.enableMultiSellerAllocation),
    });
  };

  const shortageProductIds = shortages
    .map((item) => String(item.productId || ""))
    .filter(Boolean);

  const fallbackProducts = shortageProductIds.length
    ? await Product.find({ _id: { $in: shortageProductIds } })
        .select(
          "_id sellerId name categoryId subcategoryId ownerType stock price salePrice purchasePrice variants",
        )
        .lean()
    : [];
  const fallbackProductMap = new Map(fallbackProducts.map((p) => [String(p._id), p]));

  // Fetch hub location for distance calculation
  const hubLat = Number(process.env.HUB_LOCATION_LAT || process.env.DEFAULT_HUB_LAT || 0);
  const hubLng = Number(process.env.HUB_LOCATION_LNG || process.env.DEFAULT_HUB_LNG || 0);

  const enrichedShortages = [];
  for (const item of shortages) {
    const productId = String(item.productId || "");
    const baseProduct = item.baseProduct || fallbackProductMap.get(productId) || null;

    if (item.vendorId && sellerAvailableForMasterVariant(baseProduct, item.variantId, baseProduct) >= Number(item.shortageQty || 0)) {
      const selfCost = normalizeMoney(effectiveCatalogPrice(baseProduct, item.variantId, baseProduct));
      const baseRate = baseProduct?.gstEnabled ? (baseProduct?.gstRate || 0) : 0;
      const baseGstAmount = Number((selfCost * (baseRate / 100)).toFixed(2));
      const finalSupply = Number((selfCost + baseGstAmount).toFixed(2));
      const totalProcurement = Number((finalSupply * Number(item.shortageQty || 0)).toFixed(2));

      enrichedShortages.push({
        ...item,
        vendorId: String(item.vendorId),
        selectedSellerProductId: baseProduct?.ownerType === "seller" ? String(baseProduct?._id || "") : null,
        vendorUnitCost: selfCost,
        vendorQuotedPrice: selfCost,
        pricingStrategy: "direct_vendor_mapping",
        gstRate: baseRate,
        gstAmount: baseGstAmount,
        baseSupplyPrice: selfCost,
        finalSupplyPrice: finalSupply,
        totalProcurementCost: totalProcurement,
        marginType: DEFAULT_PROCUREMENT_MARGIN_TYPE,
        marginValue: DEFAULT_PROCUREMENT_MARGIN_VALUE,
        rankedSellers: [],
      });
    } else {
      // eslint-disable-next-line no-await-in-loop
      const selections = await selectCheapestSellers(
        baseProduct,
        item.shortageQty,
        hubLat,
        hubLng,
        item.variantId || null,
      );
      if (selections.length === 0) {
        enrichedShortages.push({
          ...item,
          vendorId: null,
          selectedSellerProductId: null,
          vendorUnitCost: normalizeMoney(effectiveCatalogPrice(baseProduct, item.variantId, baseProduct)),
          vendorQuotedPrice: normalizeMoney(effectiveCatalogPrice(baseProduct, item.variantId, baseProduct)),
          pricingStrategy: "fallback_catalog_price",
          gstRate: baseProduct?.gstRate || 0,
          gstAmount: Math.round(normalizeMoney(effectiveCatalogPrice(baseProduct, item.variantId, baseProduct)) * ((baseProduct?.gstRate || 0) / 100)),
          baseSupplyPrice: normalizeMoney(effectiveCatalogPrice(baseProduct, item.variantId, baseProduct)),
          finalSupplyPrice: normalizeMoney(effectiveCatalogPrice(baseProduct, item.variantId, baseProduct)) + Math.round(normalizeMoney(effectiveCatalogPrice(baseProduct, item.variantId, baseProduct)) * ((baseProduct?.gstRate || 0) / 100)),
          totalProcurementCost: (normalizeMoney(effectiveCatalogPrice(baseProduct, item.variantId, baseProduct)) + Math.round(normalizeMoney(effectiveCatalogPrice(baseProduct, item.variantId, baseProduct)) * ((baseProduct?.gstRate || 0) / 100))) * Number(item.shortageQty || 0),
          marginType: DEFAULT_PROCUREMENT_MARGIN_TYPE,
          marginValue: DEFAULT_PROCUREMENT_MARGIN_VALUE,
          rankedSellers: [],
        });
      } else {
        let remainingToAssign = item.shortageQty;
        for (let i = 0; i < selections.length; i++) {
          const choice = selections[i];
          const allocated = settings?.enableMultiSellerAllocation ? choice.allocatedQty : remainingToAssign;
          if (allocated <= 0 && settings?.enableMultiSellerAllocation) continue;
          remainingToAssign -= allocated;
          const fallbacks = selections.slice(i + 1).map(s => s.vendorId);
          
          const vendorRate = choice.gstEnabled ? (choice.gstRate || 0) : 0;
          const vendorGstAmount = Number((choice.vendorUnitCost * (vendorRate / 100)).toFixed(2));
          const finalSupply = Number((choice.vendorUnitCost + vendorGstAmount).toFixed(2));
          const totalProcurement = Number((finalSupply * allocated).toFixed(2));
          
          enrichedShortages.push({
            ...item,
            shortageQty: allocated,
            vendorId: choice.vendorId,
            selectedSellerProductId: choice.selectedSellerProductId,
            vendorUnitCost: choice.vendorUnitCost,
            vendorQuotedPrice: choice.vendorQuotedPrice,
            pricingStrategy: choice.pricingStrategy,
            gstRate: vendorRate,
            gstAmount: vendorGstAmount,
            baseSupplyPrice: choice.vendorUnitCost,
            finalSupplyPrice: finalSupply,
            totalProcurementCost: totalProcurement,
            marginType: DEFAULT_PROCUREMENT_MARGIN_TYPE,
            marginValue: DEFAULT_PROCUREMENT_MARGIN_VALUE,
            rankedSellers: fallbacks,
          });
          if (!settings?.enableMultiSellerAllocation) break;
        }
        
        if (remainingToAssign > 0 && settings?.enableMultiSellerAllocation) {
          const fallbackCost = normalizeMoney(effectiveCatalogPrice(baseProduct, item.variantId, baseProduct));
          const baseRate = baseProduct?.gstEnabled ? (baseProduct?.gstRate || 0) : 0;
          const baseGstAmount = Number((fallbackCost * (baseRate / 100)).toFixed(2));
          const finalSupply = Number((fallbackCost + baseGstAmount).toFixed(2));
          const totalProcurement = Number((finalSupply * remainingToAssign).toFixed(2));

          enrichedShortages.push({
            ...item,
            shortageQty: remainingToAssign,
            vendorId: null,
            selectedSellerProductId: null,
            vendorUnitCost: fallbackCost,
            vendorQuotedPrice: fallbackCost,
            pricingStrategy: "fallback_catalog_price",
            gstRate: baseRate,
            gstAmount: baseGstAmount,
            baseSupplyPrice: fallbackCost,
            finalSupplyPrice: finalSupply,
            totalProcurementCost: totalProcurement,
            marginType: DEFAULT_PROCUREMENT_MARGIN_TYPE,
            marginValue: DEFAULT_PROCUREMENT_MARGIN_VALUE,
            rankedSellers: [],
          });
        }
      }
    }
  }

  const unassigned = enrichedShortages.filter((row) => !row.vendorId);
  if (unassigned.length > 0 && !allowUnassigned) {
    const names = unassigned
      .map((u) => u?.baseProduct?.name || u?.productId)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    const suffix = unassigned.length > 3 ? "..." : "";
    throw new Error(
      `Some items are out of stock and cannot be procured right now: ${names}${suffix}`,
    );
  }

  const procurementSession = await ensureProcurementSession({ order, shortages, hubId });
  const docs = [];
  const docToShortage = new Map();
  for (const item of enrichedShortages) {
    if (!item.vendorId) continue; // Unassigned skipped or handled
    const reserved = procurementSession
      ? await reserveAllocation({
          procurementSessionId: procurementSession._id,
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.shortageQty,
          vendorId: item.vendorId,
          selectedSellerProductId: item.selectedSellerProductId || null,
          rankedSellers: item.rankedSellers || [],
          retryNumber: 0,
          reason: "initial_allocation",
          eventKey: `initial:${String(order._id)}:${String(item.productId)}:${String(item.variantId || "root")}:${String(item.vendorId)}:${Number(item.shortageQty || 0)}`,
        })
      : null;

    if (reserved?.duplicate && reserved.existingPurchaseRequest) {
      continue;
    }
    if (procurementSession && !reserved?.allocation) {
      continue;
    }

    const docPayload = {
      requestId: buildRequestId(),
      orderId: order._id,
      procurementSessionId: procurementSession?._id || undefined,
      allocationId: reserved?.allocation?.allocationId || undefined,
      retryNumber: Number(reserved?.allocation?.retryNumber || 0),
      hubId,
      vendorId: item.vendorId,
      rankedSellers: item.rankedSellers || [],
      status: "created",
      expiresAt: new Date(Date.now() + sellerResponseTimeout * 60 * 1000),
      items: [{
        productId: item.productId,
        variantId: item.variantId || undefined,
        requiredQty: item.requiredQty,
        availableQtyAtHub: item.availableQtyAtHub,
        shortageQty: item.shortageQty,
        requestedQty: item.shortageQty,
        remainingQty: item.shortageQty,
        committedQty: 0,
        selectedSellerProductId: item.selectedSellerProductId || undefined,
        vendorUnitCost: item.vendorUnitCost || 0,
        vendorQuotedPrice: item.vendorQuotedPrice || 0,
        pricingStrategy: item.pricingStrategy || "",
        gstRate: item.gstRate || 0,
        gstAmount: item.gstAmount || 0,
        baseSupplyPrice: item.baseSupplyPrice || 0,
        finalSupplyPrice: item.finalSupplyPrice || 0,
        totalProcurementCost: item.totalProcurementCost || 0,
      }],
      notes: `Auto-generated from order ${order.orderId}`,
    };
    docs.push(docPayload);
    docToShortage.set(docPayload.requestId, item);
  }

  if (!docs.length) return [];
  const insertedDocs = await PurchaseRequest.insertMany(docs);
  if (procurementSession) {
    for (const doc of insertedDocs) {
      if (doc.allocationId) {
        await attachPurchaseRequestAllocation({
          procurementSessionId: procurementSession._id,
          allocationId: doc.allocationId,
          purchaseRequestId: doc._id,
        });
      }
    }
  }

  // Immediately reserve seller quantity by creating a commitment.
  for (const doc of insertedDocs) {
    const item = docToShortage.get(doc.requestId);
    if (!item.vendorId || !item.selectedSellerProductId) continue;
    try {
      await commitSellerStockForPrLine({
        selectedSellerProductId: item.selectedSellerProductId,
        masterProduct: item.baseProduct,
        masterProductId: item.productId,
        masterVariantId: item.variantId || null,
        quantity: item.shortageQty,
      });
    } catch (err) {
      console.warn("[createAutoPurchaseRequests] Failed to update seller committedStock:", err.message);
    }
  }

  return insertedDocs;
};

/**
 * Mark procurement exhausted when no eligible sellers remain in the session.
 */
async function markProcurementExhausted(pr, session) {
  pr.status = "procurement_failed";
  pr.exceptionReason = "All eligible sellers exhausted.";
  await pr.save();
  if (pr.procurementSessionId) {
    const ProcurementSession = (await import("../models/procurementSession.js")).default;
    await ProcurementSession.findByIdAndUpdate(pr.procurementSessionId, {
      $set: { status: "failed" },
    });
  }
  console.warn(
    `[Procurement Failed] Order ${pr.orderId} PR ${pr.requestId} has no more fallback sellers.`,
  );

  try {
    const Setting = (await import("../models/setting.js")).default;
    const Order = (await import("../models/order.js")).default;
    const settings = await Setting.findOne().lean();
    const order = await Order.findById(pr.orderId);

    if (order) {
      if (settings?.procurementFailureAction === "auto_cancel") {
        const { executeRollbackEvent } = await import("./transactionEngine.js");
        const { emitOrderStatusUpdate } = await import("./orderSocketEmitter.js");
        await executeRollbackEvent({
          eventType: "PROCUREMENT_FAILED",
          transactionId: `procurement_failed:${String(order._id)}`,
          orderId: order._id,
          reason: "all_sellers_exhausted_auto_cancel",
          actor: { type: "system" },
        });
        emitOrderStatusUpdate(order.orderId, { workflowStatus: "CANCELLED", status: "cancelled" });
      } else {
        if (pr.procurementSessionId) {
          const ProcurementSession = (await import("../models/procurementSession.js")).default;
          await ProcurementSession.findByIdAndUpdate(pr.procurementSessionId, {
            $set: { status: "on_hold" },
          });
        }
        order.hubStatus = "on_hold";
        await order.save();
        const { createNotification } = await import("./notificationService.js");
        const Admin = (await import("../models/admin.js")).default;
        const admins = await Admin.find({}).select("_id").lean();
        for (const admin of admins) {
          await createNotification({
            recipient: admin._id,
            recipientModel: "Admin",
            title: "Order On Hold - Procurement Failed",
            message: `Order ${order.orderId} is stuck. No sellers available for PR ${pr.requestId}.`,
            type: "system",
          });
        }
      }
    }
  } catch (e) {
    console.error("[Procurement Failed] Error executing failure policy:", e);
  }
  return null;
}

/**
 * Handle fallback to next ranked seller.
 * Called when a seller rejects, times out, or fails at pickup.
 */
export const fallbackPurchaseRequest = async (prId, remainingQty = null) => {
  const pr = await PurchaseRequest.findById(prId);
  if (!pr) return null;

  if (pr.procurementSessionId && pr.allocationId && String(pr.status) === "expired") {
    await markAllocationTimeout({
      procurementSessionId: pr.procurementSessionId,
      allocationId: pr.allocationId,
    });
  }

  const productLine = pr.items?.[0];
  if (!productLine) return null;

  const productId = productLine.productId;
  const variantId = productLine.variantId || null;
  const itemKey = buildItemKey(productId, variantId);

  const qtyToProcure =
    remainingQty !== null
      ? remainingQty
      : productLine.remainingQty || productLine.requestedQty || productLine.shortageQty || 0;

  if (qtyToProcure <= 0) return null;

  const Setting2 = (await import("../models/setting.js")).default;
  const settingsFallback = await Setting2.findOne().lean();
  const fallbackTimeout = settingsFallback?.sellerResponseTimeout || 15;

  const Product = (await import("../models/product.js")).default;
  const masterProduct = await Product.findById(productId).select("variants").lean();

  const ProcurementSession = (await import("../models/procurementSession.js")).default;
  const maxAttempts = Math.max(1, (pr.rankedSellers?.length || 0) + 10);
  let attemptGuard = 0;

  while (attemptGuard++ < maxAttempts) {
    let session = pr.procurementSessionId
      ? await ProcurementSession.findById(pr.procurementSessionId)
      : null;

    const eligibleSellers = session
      ? getEligibleFallbackSellers(session, itemKey, pr)
      : (pr.rankedSellers || []).map((id) => String(id));

    if (eligibleSellers.length === 0) {
      return markProcurementExhausted(pr, session);
    }

    const nextVendorId = eligibleSellers[0];
    const remainingRanked = eligibleSellers.slice(1);

    let selectedSellerProductId = null;
    const nextVendorProduct = await Product.findOne({
      sellerId: nextVendorId,
      masterProductId: productId,
    })
      .select("_id")
      .lean();
    if (nextVendorProduct) {
      selectedSellerProductId = nextVendorProduct._id;
    }

    const retryNumber = Number(pr.retryNumber || 0) + 1;
    let allocationRecord = null;

    if (pr.procurementSessionId) {
      const reserved = await reserveAllocation({
        procurementSessionId: pr.procurementSessionId,
        productId,
        variantId,
        quantity: qtyToProcure,
        vendorId: nextVendorId,
        selectedSellerProductId: selectedSellerProductId || null,
        rankedSellers: remainingRanked,
        retryNumber,
        sourceAllocationId: pr.allocationId || null,
        reason: "fallback_reassignment",
        eventKey: `fallback:${String(pr.procurementSessionId)}:${itemKey}:${String(nextVendorId)}:${Number(qtyToProcure)}`,
      });

      if (reserved?.duplicate) {
        if (reserved.existingPurchaseRequest?._id) {
          pr.rankedSellers = remainingRanked;
          await pr.save();
          return PurchaseRequest.findById(reserved.existingPurchaseRequest._id);
        }
        continue;
      }

      allocationRecord = reserved?.allocation || null;
      if (!allocationRecord) continue;
    }

    const newPr = await PurchaseRequest.create({
      requestId: buildRequestId(),
      orderId: pr.orderId,
      procurementSessionId: pr.procurementSessionId || undefined,
      allocationId: allocationRecord?.allocationId || undefined,
      retryNumber: allocationRecord?.retryNumber ?? retryNumber,
      hubId: pr.hubId,
      vendorId: nextVendorId,
      rankedSellers: remainingRanked,
      status: "created",
      expiresAt: new Date(Date.now() + fallbackTimeout * 60 * 1000),
      items: [
        {
          productId,
          variantId: variantId || undefined,
          selectedSellerProductId: selectedSellerProductId || undefined,
          requiredQty: productLine.requiredQty,
          availableQtyAtHub: productLine.availableQtyAtHub,
          shortageQty: qtyToProcure,
          requestedQty: qtyToProcure,
          remainingQty: qtyToProcure,
          committedQty: 0,
          vendorUnitCost: productLine.vendorUnitCost,
          vendorQuotedPrice: productLine.vendorQuotedPrice,
          pricingStrategy: "fallback_auto_reassignment",
          gstRate: productLine.gstRate,
          gstAmount: productLine.gstAmount,
          baseSupplyPrice: productLine.baseSupplyPrice,
          finalSupplyPrice: productLine.finalSupplyPrice,
          totalProcurementCost: productLine.finalSupplyPrice * qtyToProcure,
        },
      ],
      notes: `Fallback request from failed PR ${pr.requestId}`,
    });

    pr.rankedSellers = remainingRanked;
    await pr.save();

    if (pr.procurementSessionId && allocationRecord?.allocationId) {
      await attachPurchaseRequestAllocation({
        procurementSessionId: pr.procurementSessionId,
        allocationId: allocationRecord.allocationId,
        purchaseRequestId: newPr._id,
      });
    }

    try {
      await commitSellerStockForPrLine({
        selectedSellerProductId,
        masterProduct,
        masterProductId: productId,
        masterVariantId: variantId,
        quantity: qtyToProcure,
      });
    } catch (err) {
      console.warn(`[fallbackPurchaseRequest] Failed to commit stock for next seller:`, err.message);
    }

    return newPr;
  }

  return markProcurementExhausted(
    pr,
    pr.procurementSessionId ? await ProcurementSession.findById(pr.procurementSessionId) : null,
  );
};

/**
 * Release committed stock for a Purchase Request (called on rejection, expiry, or cancellation)
 */
export const releasePurchaseRequestCommitments = async (pr) => {
  if (!pr) return;
  try {
    const { executeRollbackEvent } = await import("./transactionEngine.js");
    await executeRollbackEvent({
      eventType: "SYSTEM_COMPENSATION",
      transactionId: `pr_release:${String(pr._id)}`,
      orderId: pr.orderId || null,
      purchaseRequestId: pr._id,
      allocationId: pr.allocationId || null,
      reason: "legacy_release_purchase_request_commitments",
      actor: { type: "system" },
    });
  } catch (err) {
    console.warn(`[releasePurchaseRequestCommitments] Failed to release PR ${pr.requestId} commitments:`, err.message);
  }
};
