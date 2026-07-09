import HubInventory from "../models/hubInventory.js";
import Product from "../models/product.js";
import PurchaseRequest from "../models/purchaseRequest.js";
import Seller from "../models/seller.js";
import { effectiveProductStock, normalizeVariantMatchKey } from "../utils/productHelpers.js";
import { distanceMeters } from "../utils/geoUtils.js";

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
        Number(sellerVar.stock) || 0,
      );
    }
  }

  return effectiveProductStock(sellerProduct);
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
  const calculateCanonicalProcurementCost = (sellerProduct, masterVariantId = null, baseProduct = null) => {
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
    
    let unitCost = 0;
    let gstEnabled = false;
    let gstRate = 0;

    // Priority 1: Use matched variant price
    if (sellerVar) {
      unitCost = Number(sellerVar.purchasePrice || 0);
      if (unitCost <= 0) {
        const vSale = Number(sellerVar.salePrice || 0);
        const vMrp = Number(sellerVar.price || 0);
        unitCost = vSale > 0 && vSale < vMrp ? vSale : vMrp;
      }
      gstEnabled = Boolean(sellerVar.gstEnabled);
      gstRate = Number(sellerVar.gstRate || 0);
    }
    // Priority 2: If no variant match, use first variant if exists
    else if (sellerProduct?.variants?.length > 0) {
      const v = sellerProduct.variants[0];
      unitCost = Number(v.purchasePrice || 0);
      if (unitCost <= 0) {
        const vSale = Number(v.salePrice || 0);
        const vMrp = Number(v.price || 0);
        unitCost = vSale > 0 && vSale < vMrp ? vSale : vMrp;
      }
      gstEnabled = Boolean(v.gstEnabled);
      gstRate = Number(v.gstRate || 0);
    }
    // Priority 3: Root price
    else {
      unitCost = Number(sellerProduct?.purchasePrice || 0);
      if (unitCost <= 0) {
        const sale = Number(sellerProduct?.salePrice || 0);
        const base = Number(sellerProduct?.price || 0);
        unitCost = sale > 0 && sale < base ? sale : base;
      }
      gstEnabled = Boolean(sellerProduct?.gstEnabled);
      gstRate = Number(sellerProduct?.gstRate || 0);
    }

    unitCost = normalizeMoney(unitCost);
    const rate = gstEnabled ? gstRate : 0;
    const gstAmount = Number((unitCost * (rate / 100)).toFixed(2));
    const finalSupplyPrice = Number((unitCost + gstAmount).toFixed(2));

    return {
      unitCost,
      gstEnabled,
      gstRate: rate,
      gstAmount,
      finalSupplyPrice
    };
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
    if (!baseProduct) return [];
    const matchOr = [{ masterProductId: baseProduct._id }];
    if (String(baseProduct.name || "").trim()) {
      matchOr.push({ name: String(baseProduct.name).trim() });
    }
    if (baseProduct.categoryId && baseProduct.subcategoryId) {
      matchOr.push({
        categoryId: baseProduct.categoryId,
        subcategoryId: baseProduct.subcategoryId,
      });
    }

    const candidates = await Product.find({
      ownerType: "seller",
      status: "active",
      sellerId: { $ne: null },
      $or: matchOr,
    })
      .select("_id sellerId stock name categoryId subcategoryId price salePrice purchasePrice variants gstRate gstEnabled")
      .populate("sellerId", "location rating createdAt")
      .lean();

    const inStock = candidates.filter(
      (row) => sellerAvailableForMasterVariant(row, variantId, baseProduct) > 0,
    );
    if (!inStock.length) return [];

    const scored = inStock.map((row) => {
      const costObj = calculateCanonicalProcurementCost(row, variantId, baseProduct);
      const seller = row.sellerId || {};
      
      // Calculate distance to Hub
      let distance = Infinity;
      if (hubLat !== undefined && hubLng !== undefined && seller.location?.coordinates?.length === 2) {
        const [slng, slat] = seller.location.coordinates;
        distance = distanceMeters(hubLat, hubLng, slat, slng);
      }

      const rating = Number(seller.rating || 0);
      const createdAt = seller.createdAt ? new Date(seller.createdAt).getTime() : Date.now();

      return {
        ...row,
        costObj,
        distance,
        rating,
        createdAt,
        sellerIdStr: seller._id ? String(seller._id) : null
      };
    });

    // Ranking Logic: Lowest Final Price -> Nearest Seller -> Highest Rating -> Oldest Seller
    scored.sort((a, b) => {
      if (a.costObj.finalSupplyPrice !== b.costObj.finalSupplyPrice) return a.costObj.finalSupplyPrice - b.costObj.finalSupplyPrice;
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.rating !== b.rating) return b.rating - a.rating; // Descending
      return a.createdAt - b.createdAt; // Ascending
    });

    const allocations = [];
    let remainingShortage = shortageQty;
    
    for (const vendor of scored) {
      const vendorStock = sellerAvailableForMasterVariant(
        vendor,
        variantId,
        baseProduct,
      );
      const allocateQty = remainingShortage > 0 ? Math.min(vendorStock, remainingShortage) : 0;
      
      allocations.push({
        vendorId: vendor.sellerIdStr,
        selectedSellerProductId: vendor._id ? String(vendor._id) : null,
        vendorUnitCost: vendor.costObj.unitCost,
        vendorQuotedPrice: vendor.costObj.unitCost,
        pricingStrategy: "ranked_cheapest_nearest",
        gstEnabled: vendor.costObj.gstEnabled,
        gstRate: vendor.costObj.gstRate,
        allocatedQty: allocateQty,
      });
      remainingShortage -= allocateQty;
    }

    return allocations;
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
          const allocated = choice.allocatedQty;
          if (allocated <= 0) continue;
          
          remainingToAssign -= allocated;
          const fallbacks = selections.slice(i + 1).map(s => s.vendorId);
          
          const vendorRate = choice.gstEnabled ? (choice.gstRate || 0) : 0;
          const vendorGstAmount = choice.gstAmount !== undefined ? choice.gstAmount : Number((choice.vendorUnitCost * (vendorRate / 100)).toFixed(2));
          const finalSupply = choice.finalSupplyPrice !== undefined ? choice.finalSupplyPrice : Number((choice.vendorUnitCost + vendorGstAmount).toFixed(2));
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
        }
        
        if (remainingToAssign > 0) {
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

  const docs = [];
  for (const item of enrichedShortages) {
    if (!item.vendorId) continue; // Unassigned skipped or handled
    docs.push({
      requestId: buildRequestId(),
      orderId: order._id,
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
    });
  }

  if (!docs.length) return [];
  const insertedDocs = await PurchaseRequest.insertMany(docs);

  const { freezeSellerInventory, releaseSellerReservation } = await import("./inventoryLifecycleService.js");
  // Immediately reserve seller quantity by creating a commitment
  const frozenItems = [];
  try {
    for (const item of enrichedShortages) {
      if (!item.vendorId || !item.selectedSellerProductId) continue;
      
      let targetVariantId = null;
      if (item.variantId) {
        const masterProduct = item.baseProduct;
        const masterVar = Array.isArray(masterProduct?.variants) ? masterProduct.variants.find(v => String(v._id) === String(item.variantId) || String(v.id) === String(item.variantId)) : null;
        if (masterVar) {
          const sellerProduct = await Product.findById(item.selectedSellerProductId);
          if (sellerProduct && Array.isArray(sellerProduct.variants)) {
            const masterKey = normalizeVariantMatchKey(masterVar.name);
            const sellerVar = sellerProduct.variants.find(
              (v) => normalizeVariantMatchKey(v.name) === masterKey,
            );
            if (sellerVar) targetVariantId = sellerVar._id;
          }
        }
      }
      
      await freezeSellerInventory(item.selectedSellerProductId, targetVariantId, item.shortageQty);
      frozenItems.push({ productId: item.selectedSellerProductId, variantId: targetVariantId, qty: item.shortageQty });
    }
  } catch (err) {
    console.warn("[createAutoPurchaseRequests] Failed to freeze inventory, rolling back PRs:", err.message);
    // Rollback exactly what was frozen
    for (const frozen of frozenItems) {
      try {
        await releaseSellerReservation(frozen.productId, frozen.variantId, frozen.qty);
      } catch (releaseErr) {
        console.error("[createAutoPurchaseRequests] Rollback failure:", releaseErr.message);
      }
    }
    // Delete the orphaned PRs
    await PurchaseRequest.deleteMany({ _id: { $in: insertedDocs.map(d => d._id) } });
    throw err; // Let orderController abort the order
  }

  return insertedDocs;
};

/**
 * Handle fallback to next ranked seller.
 * Called when a seller rejects, times out, or fails at pickup.
 */
export const fallbackPurchaseRequest = async (prId, remainingQty = null) => {
  const pr = await PurchaseRequest.findById(prId);
  if (!pr) return null;

  if (!pr.rankedSellers || pr.rankedSellers.length === 0) {
    pr.status = "procurement_failed";
    pr.exceptionReason = "All eligible sellers exhausted.";
    await pr.save();
    console.warn(`[Procurement Failed] Order ${pr.orderId} PR ${pr.requestId} has no more fallback sellers.`);
    
    try {
      const Setting = (await import("../models/setting.js")).default;
      const Order = (await import("../models/order.js")).default;
      const settings = await Setting.findOne().lean();
      const order = await Order.findById(pr.orderId);
      
      if (order) {
        if (settings?.procurementFailureAction === "auto_cancel") {
          const { compensateOrderCancellation } = await import("./orderCompensation.js");
          const { emitOrderStatusUpdate } = await import("./orderSocketEmitter.js");
          order.status = "cancelled";
          order.workflowStatus = "CANCELLED";
          order.cancellationReason = "Procurement failed: Items out of stock at all vendors";
          await order.save();
          await compensateOrderCancellation(order, order.orderId);
          emitOrderStatusUpdate(order.orderId, { workflowStatus: "CANCELLED", status: "cancelled" });
        } else {
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

  const nextVendorId = pr.rankedSellers.shift();
  const qtyToProcure = remainingQty !== null ? remainingQty : (pr.items[0]?.remainingQty || pr.items[0]?.requestedQty || 0);

  if (qtyToProcure <= 0) return null;

  const Setting2 = (await import("../models/setting.js")).default;
  const settingsFallback = await Setting2.findOne().lean();
  const fallbackTimeout = settingsFallback?.sellerResponseTimeout || 15;

  const Product = (await import("../models/product.js")).default;
  const masterProduct = await Product.findById(pr.items[0].productId).select("variants").lean();
  let selectedSellerProductId = null;
  
  // Find the new seller's product ID for the same master product
  const nextVendorProduct = await Product.findOne({ sellerId: nextVendorId, masterProductId: pr.items[0].productId }).select("_id").lean();
  if (nextVendorProduct) {
    selectedSellerProductId = nextVendorProduct._id;
  }

  const newPr = await PurchaseRequest.create({
    requestId: buildRequestId(),
    orderId: pr.orderId,
    hubId: pr.hubId,
    vendorId: nextVendorId,
    rankedSellers: pr.rankedSellers,
    status: "created",
    expiresAt: new Date(Date.now() + fallbackTimeout * 60 * 1000),
    items: [{
      productId: pr.items[0].productId,
      variantId: pr.items[0].variantId || undefined,
      selectedSellerProductId: selectedSellerProductId || undefined,
      requiredQty: pr.items[0].requiredQty,
      availableQtyAtHub: pr.items[0].availableQtyAtHub,
      shortageQty: qtyToProcure,
      requestedQty: qtyToProcure,
      remainingQty: qtyToProcure,
      committedQty: 0,
      vendorUnitCost: pr.items[0].vendorUnitCost,
      vendorQuotedPrice: pr.items[0].vendorQuotedPrice,
      pricingStrategy: "fallback_auto_reassignment",
      gstRate: pr.items[0].gstRate,
      gstAmount: pr.items[0].gstAmount,
      baseSupplyPrice: pr.items[0].baseSupplyPrice,
      finalSupplyPrice: pr.items[0].finalSupplyPrice,
      totalProcurementCost: pr.items[0].finalSupplyPrice * qtyToProcure,
    }],
    notes: `Fallback request from failed PR ${pr.requestId}`,
  });

  // Save the modified original PR (shifted rankedSellers array)
  await pr.save();

  // Commit stock for the new seller
  const { freezeSellerInventory } = await import("./inventoryLifecycleService.js");
  try {
    if (selectedSellerProductId) {
      if (pr.items[0].variantId && Array.isArray(masterProduct?.variants)) {
        const masterVar = masterProduct.variants.find(v => String(v._id) === String(pr.items[0].variantId) || String(v.id) === String(pr.items[0].variantId));
        if (masterVar) {
          const sellerProductFull = await Product.findById(selectedSellerProductId);
          if (sellerProductFull && Array.isArray(sellerProductFull.variants)) {
             const masterKey = normalizeVariantMatchKey(masterVar.name);
             const sellerVar = sellerProductFull.variants.find(v => normalizeVariantMatchKey(v.name) === masterKey);
             if (sellerVar) {
               await freezeSellerInventory(selectedSellerProductId, sellerVar._id, qtyToProcure);
             } else {
               await freezeSellerInventory(selectedSellerProductId, null, qtyToProcure);
             }
          }
        }
      } else {
        await freezeSellerInventory(selectedSellerProductId, null, qtyToProcure);
      }
    }
  } catch (err) {
    console.warn(`[fallbackPurchaseRequest] Failed to commit stock for next seller:`, err.message);
  }

  return newPr;
};

/**
 * Release committed stock for a Purchase Request (called on rejection, expiry, or cancellation)
 */
export const releasePurchaseRequestCommitments = async (pr) => {
  if (!pr || !pr.items || !pr._id) return;
  const PurchaseRequest = (await import("../models/purchaseRequest.js")).default;
  
  // Idempotency Lock: Prevent double-releasing stock if multiple concurrent processes try to release this PR
  const lock = await PurchaseRequest.findOneAndUpdate(
    { _id: pr._id, commitmentsReleased: { $ne: true } },
    { commitmentsReleased: true },
    { new: true }
  );
  if (!lock) {
    console.log(`[Idempotency] PR ${pr._id} commitments already released. Skipping.`);
    return;
  }

  const Product = (await import("../models/product.js")).default;
  const { releaseSellerReservation } = await import("./inventoryLifecycleService.js");
  for (const item of pr.items) {
    if (!item.selectedSellerProductId) continue;
    try {
      const releaseQty = Number(item.shortageQty) || 0;
      if (releaseQty <= 0) continue;
      
      if (item.variantId) {
        const masterProduct = await Product.findById(item.productId).select("variants").lean();
        const masterVar = Array.isArray(masterProduct?.variants) ? masterProduct.variants.find(v => String(v._id) === String(item.variantId) || String(v.id) === String(item.variantId)) : null;
        if (masterVar) {
          const sellerProduct = await Product.findById(item.selectedSellerProductId);
          if (sellerProduct && Array.isArray(sellerProduct.variants)) {
            const masterKey = normalizeVariantMatchKey(masterVar.name);
            const sellerVar = sellerProduct.variants.find(
              (v) => normalizeVariantMatchKey(v.name) === masterKey,
            );
            if (sellerVar) {
              await releaseSellerReservation(item.selectedSellerProductId, sellerVar._id, releaseQty);
            } else {
              await releaseSellerReservation(item.selectedSellerProductId, null, releaseQty);
            }
          }
        }
      } else {
        await releaseSellerReservation(item.selectedSellerProductId, null, releaseQty);
      }
    } catch (err) {
      console.warn(`[releasePurchaseRequestCommitments] Failed to release PR ${pr.requestId} commitments:`, err.message);
    }
  }
};
