import mongoose from "mongoose";
import crypto from "crypto";
import PurchaseRequest from "../models/purchaseRequest.js";
import HubInward from "../models/hubInward.js";
import HubInventory from "../models/hubInventory.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import Seller from "../models/seller.js";
import PickupPartner from "../models/pickupPartner.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { startHubDeliverySearchAtomic } from "../services/orderWorkflowService.js";
import Transaction from "../models/transaction.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";
import {
  mapPrItemsDetailed,
  summarizePrPricing,
  mapPrKeyDates,
  buildPrTimeline,
} from "../utils/purchaseRequestHelpers.js";
import {
  acceptQAInventory,
  receiveInventoryAtHub,
} from "../services/inventory/inventoryEngine.js";
import {
  markAllocationFromSellerResponse,
  markAllocationCompletedFromInward,
  evaluateProcurementSessionCompletion,
  releaseAllocationSellerStock,
  buildItemKey,
} from "../services/procurementSessionService.js";
import {
  isOrderInventoryReadyForDelivery,
  createPurchaseRequest,
  savePurchaseRequest,
  applyLineSellerQuantities,
  syncPrAggregateStatus,
  isPickupEligibleLine,
  isRetryEligibleLineStatus,
  buildPrLineKey,
  normalizePrLine,
} from "../services/purchaseRequestService.js";
import { markOrderReadyForPacking, persistOrder } from "../services/workflowFacade.js";

const DEFAULT_HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";

const ALLOWED_STATUSES = new Set([
  "created",
  "vendor_confirmed",
  "pickup_assigned",
  "picked",
  "hub_delivered",
  "received_at_hub",
  "verified",
  "closed",
  "cancelled",
  "exception",
]);

const PR_DONE_STATUSES = new Set(["verified", "closed", "cancelled"]);

const PR_IN_DELIVERY_STATUSES = new Set([
  "pickup_assigned",
  "picked",
  "hub_delivered",
]);

const PR_AWAITING_VENDOR_STATUSES = new Set(["created", "vendor_confirmed"]);

const prStatusLabel = (status) => {
  const map = {
    created: "Pending vendor",
    vendor_confirmed: "Vendor confirmed",
    pickup_assigned: "Pickup assigned",
    picked: "In transit to hub",
    hub_delivered: "At hub gate",
    received_at_hub: "Received at hub",
    verified: "Verified & stocked",
    closed: "Closed",
    cancelled: "Cancelled",
    exception: "Exception",
  };
  return map[String(status || "")] || String(status || "—");
};

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

const hashPickupOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");

const generateRequestId = () =>
  `PR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

const pickBestPickupPartner = async (hubId = DEFAULT_HUB_ID) => {
  const candidates = await PickupPartner.find({
    hubId: String(hubId || DEFAULT_HUB_ID),
    isActive: true,
    isVerified: true,
    status: { $in: ["available", "active"] },
  })
    .select("_id name status")
    .lean();

  if (!candidates.length) return null;

  const ids = candidates.map((c) => c._id);
  const activeCounts = await PurchaseRequest.aggregate([
    {
      $match: {
        pickupPartnerId: { $in: ids },
        status: { $in: ["pickup_assigned", "picked"] },
      },
    },
    {
      $group: {
        _id: "$pickupPartnerId",
        count: { $sum: 1 },
      },
    },
  ]);
  const countMap = new Map(
    activeCounts.map((r) => [String(r._id), Number(r.count || 0)]),
  );

  const sorted = [...candidates].sort((a, b) => {
    const ac = countMap.get(String(a._id)) || 0;
    const bc = countMap.get(String(b._id)) || 0;
    if (ac !== bc) return ac - bc;
    if (a.status === "available" && b.status !== "available") return -1;
    if (b.status === "available" && a.status !== "available") return 1;
    return 0;
  });

  return sorted[0] || null;
};

const assignPickupToRequest = async (doc, partner) => {
  const eligibleItems = (doc.items || []).filter(isPickupEligibleLine);
  if (eligibleItems.length === 0) {
    throw new Error("No accepted product lines are eligible for pickup assignment");
  }

  doc.pickupPartnerId = partner._id;
  doc.pickupPartnerName = String(partner.name || "").trim();
  // OTP is generated only after parcel photos (generateAssignmentPickupOtp).
  // Creating OTP here skipped the photos step in the partner app.
  doc.pickupOtpCode = undefined;
  doc.pickupOtpHash = undefined;
  doc.pickupOtpExpiresAt = undefined;
  doc.pickupOtpVerifiedAt = undefined;
  doc.pickupProof = undefined;
  doc.hubDropProof = undefined;
  doc.exceptionReason = "";
  doc.status = "pickup_assigned";
  doc.pickupAssignedAt = new Date();
  await savePurchaseRequest(doc);
  await PickupPartner.findByIdAndUpdate(partner._id, {
    $set: { status: "active", isActive: true },
  });

  // Notify pickup partner about new assignment
  try {
    const { createNotification } = await import("../services/notificationService.js");
    
    const firstItem = eligibleItems[0];
    const productName = firstItem?.productId?.name || "Products";
    const qty = firstItem?.committedQty || firstItem?.shortageQty || firstItem?.requiredQty || 0;
    const moreCount = eligibleItems.length - 1;
    const itemSummary = `${productName} x ${qty}${moreCount > 0 ? ` (+${moreCount} more)` : ""}`;
    
    await createNotification({
      recipient: partner._id,
      recipientModel: "PickupPartner",
      title: "New Pickup Task",
      message: `Pickup ${itemSummary} from ${doc.vendorName || "a vendor"}. Request ID: ${doc.requestId}`,
      type: "order",
      data: { 
        requestId: doc.requestId, 
        purchaseRequestId: doc._id.toString(),
        orderId: doc.orderId?.toString(),
        productSummary: itemSummary
      },
    });
  } catch (error) {
    console.warn("[assignPickupToRequest] Notification failed:", error.message);
  }

  return null;
};

const findPrLine = (pr, productId, variantId = null) => {
  const targetKey = buildPrLineKey(productId, variantId);
  return (pr.items || []).find((line) => {
    const row = normalizePrLine(line);
    const key = row.itemKey || buildPrLineKey(row.productId, row.variantId);
    return key === targetKey;
  });
};

const maybeAssignPickup = async (pr) => {
  const hasEligible = (pr.items || []).some(isPickupEligibleLine);
  if (!hasEligible || pr.pickupPartnerId) return false;

  const bestPartner = await pickBestPickupPartner(pr.hubId);
  if (bestPartner) {
    await assignPickupToRequest(pr, bestPartner);
    return true;
  }

  pr.status = "exception";
  pr.exceptionReason = "No pickup partners available";
  await savePurchaseRequest(pr);
  return false;
};

const mapPrPhase = (status) => {
  if (PR_IN_DELIVERY_STATUSES.has(status)) return "in_delivery";
  if (PR_AWAITING_VENDOR_STATUSES.has(status)) return "awaiting_vendor";
  if (status === "received_at_hub") return "at_hub";
  if (status === "exception") return "exception";
  if (PR_DONE_STATUSES.has(status)) return "completed";
  return "other";
};

const mapRow = (reqDoc, extras = {}) => {
  const items = mapPrItemsDetailed(reqDoc.items);
  const item = items[0] || null;
  const pricing = summarizePrPricing(reqDoc.items);
  const quantity = item?.quantity || 0;
  const status = String(reqDoc.status || "");
  const dates = mapPrKeyDates(reqDoc, extras);
  const timeline = buildPrTimeline(reqDoc, extras);

  return {
    _id: reqDoc._id,
    requestId: reqDoc.requestId,
    orderId: reqDoc.orderId?._id || reqDoc.orderId || null,
    hubId: reqDoc.hubId || DEFAULT_HUB_ID,
    vendorId: reqDoc.vendorId?._id || reqDoc.vendorId || null,
    vendorName:
      reqDoc.vendorId?.shopName ||
      reqDoc.vendorId?.name ||
      reqDoc.vendorName ||
      "Unassigned Vendor",
    vendorPhone: reqDoc.vendorId?.phone || "",
    productId: item?.productId || null,
    product:
      item?.productName ||
      reqDoc.product ||
      (items.length > 1 ? `${items.length} items` : "Product"),
    quantity,
    unitCost: item?.unitCost || 0,
    totalCost: pricing.grandTotal,
    subtotal: pricing.subtotal,
    gstTotal: pricing.gstTotal,
    gstRate: item?.gstRate || 0,
    gstAmount: item?.gstAmount || 0,
    status,
    statusLabel: prStatusLabel(status),
    phase: mapPrPhase(status),
    isOpen: !PR_DONE_STATUSES.has(status),
    vendorResponse: reqDoc.vendorResponse?.status || "pending",
    vendorResponseDetail: reqDoc.vendorResponse || { status: "pending" },
    pickupPartnerId: reqDoc.pickupPartnerId?._id || reqDoc.pickupPartnerId || null,
    pickupPartnerName:
      reqDoc.pickupPartnerId?.name || reqDoc.pickupPartnerName || "",
    pickupPartnerPhone: reqDoc.pickupPartnerId?.phone || "",
    notes: reqDoc.notes || "",
    exceptionReason: reqDoc.exceptionReason || "",
    eta: reqDoc.eta || null,
    dates,
    timeline,
    createdAt: reqDoc.createdAt,
    updatedAt: reqDoc.updatedAt,
    confirmedAt: dates.confirmedAt,
    expiresAt: reqDoc.expiresAt,
    requestType: reqDoc.requestType || (reqDoc.orderId ? "automated" : "manual"),
    items,
    pickupProof: reqDoc.pickupProof || null,
    hubDropProof: reqDoc.hubDropProof || null,
    vendorHandover: reqDoc.vendorHandover || null,
    hubInward: extras.hubInward || null,
  };
};

const mapSellerRow = (reqDoc, extras = {}) => {
  const items = mapPrItemsDetailed(reqDoc.items);
  const pricing = summarizePrPricing(reqDoc.items);
  const dates = mapPrKeyDates(reqDoc, extras);
  const timeline = buildPrTimeline(reqDoc, extras);

  return {
    _id: reqDoc._id,
    requestId: reqDoc.requestId,
    orderId: reqDoc.orderId?._id || reqDoc.orderId || null,
    orderCode: reqDoc.orderId?.orderId || "",
    hubId: reqDoc.hubId,
    status: reqDoc.status,
    statusLabel: prStatusLabel(reqDoc.status),
    vendorResponse: reqDoc.vendorResponse || { status: "pending" },
    vendorReadyAt: reqDoc.vendorReadyAt || null,
    vendorReadyNotes: reqDoc.vendorReadyNotes || "",
    pickupPartner: reqDoc.pickupPartnerId
      ? {
          id: reqDoc.pickupPartnerId?._id || reqDoc.pickupPartnerId,
          name:
            reqDoc.pickupPartnerId?.name ||
            reqDoc.pickupPartnerName ||
            "Pickup Partner",
          phone: reqDoc.pickupPartnerId?.phone || "",
        }
      : null,
    pickupAssigned: Boolean(reqDoc.pickupPartnerId),
    pickupOtp:
      String(reqDoc.status) === "pickup_assigned" &&
      (!reqDoc.pickupOtpExpiresAt || new Date(reqDoc.pickupOtpExpiresAt) > new Date())
        ? String(reqDoc.pickupOtpCode || "")
        : "",
    pickupOtpExpiresAt: reqDoc.pickupOtpExpiresAt || null,
    items,
    pricing,
    dates,
    timeline,
    confirmedAt: dates.confirmedAt,
    notes: reqDoc.notes || "",
    exceptionReason: reqDoc.exceptionReason || "",
    eta: reqDoc.eta || null,
    createdAt: reqDoc.createdAt,
    updatedAt: reqDoc.updatedAt,
    expiresAt: reqDoc.expiresAt,
    requestType: reqDoc.requestType || (reqDoc.orderId ? "automated" : "manual"),
    pickupProof: reqDoc.pickupProof || null,
    hubDropProof: reqDoc.hubDropProof || null,
  };
};

export const getPurchaseRequestProductContext = async (req, res) => {
  try {
    const { productId, variantId } = req.query;
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return handleResponse(res, 400, "Valid productId is required");
    }

    const product = await Product.findById(productId)
      .populate("sellerId", "shopName name phone email isVerified status")
      .populate("categoryId", "name")
      .populate("subcategoryId", "name")
      .populate({
        path: "masterProductId",
        select: "name slug status price salePrice stock mainImage unit",
      })
      .lean();

    if (!product || product.ownerType !== "seller") {
      return handleResponse(res, 404, "Seller listing not found");
    }

    const vendorId = product.sellerId?._id || product.sellerId;
    if (!vendorId) {
      return handleResponse(res, 400, "This product has no linked vendor");
    }

    const variantRows = Array.isArray(product.variants) ? product.variants : [];
    const selectedVariant =
      variantId && variantRows.length
        ? variantRows.find((v) => String(v._id) === String(variantId))
        : null;

    const sellerStock = (() => {
      if (selectedVariant) {
        return Math.max(0, Number(selectedVariant.stock) || 0);
      }
      if (variantRows.length) {
        return variantRows.reduce((sum, v) => sum + (Number(v?.stock) || 0), 0);
      }
      return Math.max(0, Number(product.stock) || 0);
    })();

    const isCatalogListing = Boolean(product.masterProductId);
    const listingType = isCatalogListing ? "catalog" : "seller_own";
    const supplyPrice = selectedVariant
      ? Number(selectedVariant.purchasePrice ?? selectedVariant.price) ||
        Number(product.purchasePrice ?? product.price ?? product.salePrice ?? 0)
      : Number(product.purchasePrice ?? product.price ?? product.salePrice ?? 0);

    const [openRequests, recentCompleted] = await Promise.all([
      PurchaseRequest.find({
        vendorId,
        status: { $nin: Array.from(PR_DONE_STATUSES) },
        "items.productId": product._id,
      })
        .populate("vendorId", "shopName name")
        .populate("items.productId", "name mainImage unit")
        .populate("pickupPartnerId", "name phone")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      PurchaseRequest.find({
        vendorId,
        status: { $in: ["verified", "closed"] },
        "items.productId": product._id,
      })
        .populate("items.productId", "name")
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const mapContextRow = (row) => {
      const line = (row.items || []).find(
        (it) => String(it.productId?._id || it.productId) === String(product._id),
      ) || row.items?.[0];
      const phase = PR_IN_DELIVERY_STATUSES.has(row.status)
        ? "in_delivery"
        : PR_AWAITING_VENDOR_STATUSES.has(row.status)
          ? "awaiting_vendor"
          : row.status === "received_at_hub"
            ? "at_hub"
            : row.status === "exception"
              ? "exception"
              : "other";

      const quantity = Number(line?.shortageQty || line?.requiredQty || 0);
      const unitCost = Number(line?.vendorUnitCost || 0);
      return {
        _id: row._id,
        requestId: row.requestId,
        productName: line?.productId?.name || product.name,
        status: row.status,
        statusLabel: prStatusLabel(row.status),
        phase,
        quantity,
        unitCost,
        totalCost: toMoney(unitCost * quantity + Number(line?.gstAmount || 0)),
        vendorResponse: row.vendorResponse?.status || "pending",
        pickupPartner: row.pickupPartnerId
          ? {
              name: row.pickupPartnerId?.name || row.pickupPartnerName || "Pickup",
              phone: row.pickupPartnerId?.phone || "",
            }
          : null,
        notes: row.notes || "",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        isOpen: !PR_DONE_STATUSES.has(row.status),
      };
    };

    const open = openRequests.map(mapContextRow);
    const hasBlockingRequest = open.length > 0;
    const inDelivery = open.filter((r) => r.phase === "in_delivery");
    const awaitingVendor = open.filter((r) => r.phase === "awaiting_vendor");

    return handleResponse(res, 200, "Purchase request context loaded", {
      product: {
        _id: product._id,
        name: product.name,
        mainImage: product.mainImage,
        status: product.status,
        unit: product.unit,
        brand: product.brand,
        category: product.categoryId?.name || null,
        subcategory: product.subcategoryId?.name || null,
        sellerStock,
        supplyPrice,
        variants: (product.variants || []).map((v) => ({
          _id: v._id,
          name: v.name,
          unit: v.unit || product.unit,
          stock: Number(v.stock) || 0,
          price: Number(v.purchasePrice ?? v.price ?? v.salePrice) || supplyPrice,
        })),
        selectedVariant: selectedVariant
          ? {
              _id: selectedVariant._id,
              name: selectedVariant.name,
              unit: selectedVariant.unit || product.unit,
              stock: Math.max(0, Number(selectedVariant.stock) || 0),
              price:
                Number(selectedVariant.purchasePrice ?? selectedVariant.price) ||
                supplyPrice,
            }
          : null,
      },
      vendor: {
        _id: vendorId,
        shopName: product.sellerId?.shopName || product.sellerId?.name || "Vendor",
        name: product.sellerId?.name || "",
        phone: product.sellerId?.phone || "",
        isVerified: product.sellerId?.isVerified,
      },
      listingType,
      listingTypeLabel: isCatalogListing
        ? "Hub catalog listing"
        : "Seller-owned product",
      masterProduct: isCatalogListing
        ? {
            _id: product.masterProductId?._id || product.masterProductId,
            name: product.masterProductId?.name || "Master product",
            customerPrice:
              product.masterProductId?.salePrice ||
              product.masterProductId?.price ||
              null,
          }
        : null,
      openRequests: open,
      inDelivery,
      awaitingVendor,
      recentCompleted: recentCompleted.map(mapContextRow),
      hasBlockingRequest,
      canCreateRequest: sellerStock > 0 && !hasBlockingRequest,
      blockReason: hasBlockingRequest
        ? "An open purchase request already exists for this seller listing."
        : sellerStock <= 0
          ? "Seller has no stock available to procure."
          : null,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

const loadPurchaseRequestDetail = async (id) => {
  const doc = await PurchaseRequest.findById(id)
    .populate("vendorId", "shopName name phone email")
    .populate("orderId", "orderId status")
    .populate("items.productId", "name mainImage unit sku")
    .populate("pickupPartnerId", "name phone")
    .lean();
  if (!doc) return null;

  const [inward, txn] = await Promise.all([
    HubInward.findOne({ purchaseRequestId: doc._id }).sort({ createdAt: -1 }).lean(),
    Transaction.findOne({
      reference: { $in: [`PR-REC-${doc.requestId}`, `PR-SETTLE-${doc.requestId}`] },
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const extras = {
    receivedAtHub: inward?.createdAt || doc.receivedAtHubAt || null,
    verifiedAt: txn?.meta?.verifiedAt || doc.verifiedAt || null,
    hubInward: inward
      ? {
          _id: inward._id,
          verificationStatus: inward.verificationStatus,
          receivedItems: inward.receivedItems || [],
          notes: inward.notes || "",
          createdAt: inward.createdAt,
          verifiedAt: inward.updatedAt,
        }
      : null,
  };

  return mapRow(doc, extras);
};

export const getPurchaseRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return handleResponse(res, 400, "Valid purchase request id is required");
    }

    const mapped = await loadPurchaseRequestDetail(id);
    if (!mapped) return handleResponse(res, 404, "Purchase request not found");

    if (req.user?.role === "seller") {
      const vendorId = String(mapped.vendorId || "");
      if (vendorId !== String(req.user.id)) {
        return handleResponse(res, 403, "Not authorized to view this request");
      }
      return handleResponse(res, 200, "Purchase request loaded", mapSellerRow(
        await PurchaseRequest.findById(id)
          .populate("orderId", "orderId")
          .populate("items.productId", "name mainImage unit")
          .populate("pickupPartnerId", "name phone")
          .lean(),
        {
          receivedAtHub: mapped.dates?.receivedAtHub,
          verifiedAt: mapped.dates?.verifiedAt,
        },
      ));
    }

    return handleResponse(res, 200, "Purchase request loaded", mapped);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getPurchaseRequests = async (req, res) => {
  try {
    const {
      status,
      orderId,
      requestId,
      hubId = DEFAULT_HUB_ID,
      vendorId,
      productId,
      openOnly,
    } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const query = {};
    if (hubId && hubId !== "all") query.hubId = String(hubId);
    if (status && status !== "all") query.status = status;
    if (orderId && mongoose.Types.ObjectId.isValid(orderId)) query.orderId = orderId;
    if (requestId) query.requestId = { $regex: String(requestId), $options: "i" };
    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      query.vendorId = vendorId;
    }
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      query["items.productId"] = productId;
    }
    if (String(openOnly || "").toLowerCase() === "true") {
      query.status = { $nin: Array.from(PR_DONE_STATUSES) };
    }

    const [items, total] = await Promise.all([
      PurchaseRequest.find(query)
        .populate("vendorId", "shopName name phone")
        .populate("orderId", "orderId status")
        .populate("items.productId", "name mainImage unit")
        .populate("pickupPartnerId", "name phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseRequest.countDocuments(query),
    ]);

    const mapped = items.map(mapRow);
    const openCount = mapped.filter((row) => row.isOpen).length;

    return handleResponse(res, 200, "Purchase requests fetched", {
      items: mapped,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      openCount,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Legacy single-item Manual PR create — aligned to standalone Manual PR inventory rules.
 * Delegates to the same transactional create path as POST /manual.
 */
export const createManualPurchaseRequest = async (req, res) => {
  try {
    const {
      vendorId,
      productId,
      quantity,
      hubId = DEFAULT_HUB_ID,
      notes,
      variantId,
      variantName,
    } = req.body || {};

    const variantNote =
      variantName ? `Variant: ${String(variantName).trim()}` : "";
    const mergedNotes = [variantNote, String(notes || "").trim()].filter(Boolean).join(" · ");

    const result = await createStandaloneManualPRCore({
      vendorId,
      hubId,
      notes: mergedNotes,
      items: [
        {
          productId,
          variantId,
          quantity,
          notes: mergedNotes,
        },
      ],
    });

    return handleResponse(
      res,
      201,
      "Purchase request created successfully",
      mapRow(result.hydrated),
    );
  } catch (error) {
    const status = error?.statusCode || (error?.code === 11000 ? 400 : 500);
    return handleResponse(
      res,
      status,
      error?.code === 11000 ? "Duplicate purchase request id, retry" : error.message,
      error?.data,
    );
  }
};

export const updatePurchaseRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, eta } = req.body || {};

    if (!ALLOWED_STATUSES.has(String(status || ""))) {
      return handleResponse(res, 400, "Invalid status");
    }

    const doc = await PurchaseRequest.findById(id);
    if (!doc) return handleResponse(res, 404, "Purchase request not found");

    // Manual PR cancel must use inventory-safe path (never status-only).
    const { isStandaloneManualPR } = await import("../services/manualPurchaseRequestInventoryService.js");
    if (String(status) === "cancelled" && isStandaloneManualPR(doc)) {
      req.params.id = id;
      req.body = { status: "cancelled", notes };
      return updateManualPRStatus(req, res);
    }

    doc.status = status;
    if (notes !== undefined) doc.notes = String(notes || "");
    if (eta) doc.eta = new Date(eta);
    await savePurchaseRequest(doc);

    return handleResponse(res, 200, "Purchase request status updated", doc);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const assignPickupPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { pickupPartnerId, pickupPartnerName } = req.body || {};

    const doc = await PurchaseRequest.findById(id).populate("items.productId", "name");
    if (!doc) return handleResponse(res, 404, "Purchase request not found");

    if (pickupPartnerId) {
      const partner = await PickupPartner.findById(pickupPartnerId).lean();
      if (!partner) return handleResponse(res, 404, "Pickup partner not found");
      await assignPickupToRequest(doc, partner);
      return handleResponse(res, 200, "Pickup partner assigned", {
        ...doc.toObject(),
        // OTP created later after parcel photos — not at assign time
        pickupOtp: "",
        pickupOtpExpiresAt: null,
      });
    } else {
      doc.pickupPartnerId = null;
      doc.pickupPartnerName = String(pickupPartnerName || "").trim();
      doc.pickupOtpCode = undefined;
      doc.pickupOtpHash = undefined;
      doc.pickupOtpExpiresAt = undefined;
      doc.pickupOtpVerifiedAt = undefined;
      doc.status = "seller_confirmed";
      await savePurchaseRequest(doc);
      return handleResponse(res, 200, "Pickup partner assignment cleared", doc);
    }
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const assignVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId } = req.body || {};
    if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
      return handleResponse(res, 400, "Valid vendorId is required");
    }

    const [doc, vendor] = await Promise.all([
      PurchaseRequest.findById(id),
      Seller.findById(vendorId).select("_id shopName name"),
    ]);
    if (!doc) return handleResponse(res, 404, "Purchase request not found");
    if (!vendor) return handleResponse(res, 404, "Vendor not found");

    doc.vendorId = vendor._id;
    if (doc.status === "cancelled") {
      doc.status = "created";
    }
    await savePurchaseRequest(doc);

    return handleResponse(res, 200, "Vendor assigned successfully", doc);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const receiveAtHub = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, notes } = req.body || {};

    const pr = await PurchaseRequest.findById(id).populate("items.productId", "name");
    if (!pr) return handleResponse(res, 404, "Purchase request not found");
    if (!["picked", "hub_delivered", "pickup_assigned"].includes(String(pr.status))) {
      return handleResponse(
        res,
        400,
        "Request must be picked/hub_delivered before receiving at hub",
      );
    }

    const incomingItems = Array.isArray(items) ? items : [];
    const normalized = [];
    const isStandaloneManual = !pr.orderId;

    for (const line of pr.items || []) {
      const productId = String(line.productId?._id || line.productId);
      const incoming =
        incomingItems.find((it) => String(it.productId) === productId) ||
        incomingItems.find(
          (it) =>
            String(it.productId) === String(line.selectedSellerProductId || "") ||
            String(it.sellerProductId || "") === productId,
        ) ||
        {};
      const expectedQty = Number(
        line.actualPickedQty ||
          line.committedQty ||
          line.shortageQty ||
          line.requestedQty ||
          line.requiredQty ||
          0,
      );
      const receivedQty = Math.max(
        0,
        Number(incoming.receivedQty ?? expectedQty ?? 0),
      );
      const damagedQty = Math.max(0, Number(incoming.damagedQty || 0));
      const acceptedQty = Math.max(0, receivedQty - damagedQty);
      const fallbackCost = toMoney(Number(line.vendorUnitCost || 0));
      const incomingCost = toMoney(
        incoming.purchaseUnitCost !== undefined ? incoming.purchaseUnitCost : fallbackCost,
      );

      // --- SELLER STOCK VALIDATION REMOVED (Handled at Pickup) ---
      const targetSellerProductId = String(line.selectedSellerProductId || productId);

      // --- HUB-FIRST LOGIC: Resolve Master ID for Inventory ---
      const sellerProductData = await Product.findById(targetSellerProductId).select(
        "masterProductId ownerType variants",
      );
      const resolvedMasterProductId =
        sellerProductData?.ownerType === "seller" && sellerProductData?.masterProductId
          ? String(sellerProductData.masterProductId)
          : productId;

      // Cost bookkeeping on hub row (qty for Manual PR is applied via inventory engine below)
      const hubRow = await HubInventory.findOne({
        hubId: pr.hubId || DEFAULT_HUB_ID,
        productId: resolvedMasterProductId,
      });

      if (hubRow) {
        const prevQty = Math.max(0, Number(hubRow.availableQty || 0));
        const prevAvgCost = Math.max(
          0,
          Number(hubRow.avgPurchaseCost || hubRow.lastPurchaseCost || 0),
        );
        // For Manual PR, qty lands via transferManualPRInventoryAtHubReceive; use projected qty for cost only.
        const qtyForCost = isStandaloneManual
          ? prevQty + acceptedQty
          : prevQty;
        const nextQty = isStandaloneManual ? qtyForCost : prevQty + acceptedQty;
        const weightedAvgCost =
          nextQty > 0
            ? toMoney((prevQty * prevAvgCost + acceptedQty * incomingCost) / Math.max(nextQty, 1))
            : incomingCost;

        const masterProduct = await Product.findById(resolvedMasterProductId).select(
          "price salePrice",
        );
        const sellPrice = masterProduct?.price || masterProduct?.salePrice || incomingCost;
        hubRow.lastPurchaseCost = incomingCost;
        hubRow.avgPurchaseCost = weightedAvgCost;
        hubRow.sellPrice = sellPrice;
        hubRow.priceUpdatedAt = new Date();
        // Automated path historically did not write availableQty here (QA does).
        // Manual path writes via inventory engine; refresh status after that.
        if (!isStandaloneManual) {
          if (hubRow.availableQty <= 0) hubRow.status = "out_of_stock";
          else if (hubRow.availableQty <= Number(hubRow.reorderLevel || 0))
            hubRow.status = "low_stock";
          else hubRow.status = "healthy";
        }
        await hubRow.save();
      } else if (!isStandaloneManual) {
        const masterProduct = await Product.findById(resolvedMasterProductId).select(
          "price salePrice",
        );
        const sellPrice = masterProduct?.price || masterProduct?.salePrice || incomingCost;

        await HubInventory.create({
          hubId: pr.hubId || DEFAULT_HUB_ID,
          productId: resolvedMasterProductId,
          availableQty: 0,
          reservedQty: 0,
          reorderLevel: 10,
          lastPurchaseCost: incomingCost,
          avgPurchaseCost: incomingCost,
          sellPrice,
          priceUpdatedAt: new Date(),
          status: "out_of_stock",
        });
      }

      // Manual PR: ownership transfer at Hub Receive (SC → 0, HA += acceptedQty)
      if (isStandaloneManual && acceptedQty > 0) {
        let sellerVariantId = line.variantId || null;
        // Manual PR line.variantId is the seller variant id (create uses seller catalog).
        try {
          const { transferManualPRInventoryAtHubReceive } = await import(
            "../services/manualPurchaseRequestInventoryService.js"
          );
          await transferManualPRInventoryAtHubReceive({
            pr,
            masterProductId: resolvedMasterProductId,
            sellerProductId: targetSellerProductId,
            sellerVariantId,
            acceptedQty,
            hubId: pr.hubId || DEFAULT_HUB_ID,
          });
          line.committedQty = Math.max(0, Number(line.committedQty || 0) - acceptedQty);

          // Refresh costs/status after engine upserted HA
          const refreshedHub = await HubInventory.findOne({
            hubId: pr.hubId || DEFAULT_HUB_ID,
            productId: resolvedMasterProductId,
          });
          if (refreshedHub) {
            const masterProduct = await Product.findById(resolvedMasterProductId).select(
              "price salePrice",
            );
            const sellPrice =
              masterProduct?.price || masterProduct?.salePrice || incomingCost;
            const prevQty = Math.max(0, Number(refreshedHub.availableQty || 0) - acceptedQty);
            const prevAvgCost = Math.max(
              0,
              Number(refreshedHub.avgPurchaseCost || refreshedHub.lastPurchaseCost || 0),
            );
            const nextQty = Math.max(0, Number(refreshedHub.availableQty || 0));
            refreshedHub.lastPurchaseCost = incomingCost;
            refreshedHub.avgPurchaseCost =
              nextQty > 0
                ? toMoney(
                    (prevQty * prevAvgCost + acceptedQty * incomingCost) / nextQty,
                  )
                : incomingCost;
            refreshedHub.sellPrice = sellPrice;
            refreshedHub.priceUpdatedAt = new Date();
            if (refreshedHub.availableQty <= 0) refreshedHub.status = "out_of_stock";
            else if (refreshedHub.availableQty <= Number(refreshedHub.reorderLevel || 0))
              refreshedHub.status = "low_stock";
            else refreshedHub.status = "healthy";
            await refreshedHub.save();
          }
        } catch (invErr) {
          console.error(
            `[receiveAtHub] Manual PR inventory transfer failed for ${pr.requestId}:`,
            invErr.message,
          );
          throw invErr;
        }
      }

      normalized.push({
        productId: resolvedMasterProductId, // Store the resolved Master ID in the inward record
        sellerProductId: targetSellerProductId, // Keep track of which seller item it was
        variantId: line.variantId || null,
        expectedQty,
        receivedQty,
        damagedQty,
        purchaseUnitCost: incomingCost,
        acceptedQty,
        qualityStatus: incoming.qualityStatus || "ok",
      });
    }

    await HubInward.create({
      purchaseRequestId: pr._id,
      hubId: pr.hubId || DEFAULT_HUB_ID,
      receivedItems: normalized,
      verificationStatus: "pending",
      receivedBy: req.user?.id || null,
      receivedByModel: "Admin",
      notes: String(notes || ""),
    });

    pr.status = "received_at_hub";
    pr.receivedAtHubAt = new Date();
    await savePurchaseRequest(pr);

    // Trace: Create a PENDING transaction immediately upon receipt for financial visibility
    try {
      let totalValue = normalized.reduce((acc, item) => acc + (item.acceptedQty * item.purchaseUnitCost), 0);
      if (totalValue > 0) {
        await Transaction.create({
          user: pr.vendorId,
          userModel: "Seller",
          order: pr.orderId || undefined,
          type: "Supply Earning",
          amount: totalValue,
          status: "Pending", // Visible but not yet withdrawable
          reference: `PR-REC-${pr.requestId}`,
          meta: {
            purchaseRequestId: pr._id,
            receivedAt: new Date(),
          }
        });
        console.log(`[Trace] Created Pending Supply Earning for Seller ${pr.vendorId}: ₹${totalValue}`);
      }
    } catch (txnErr) {
      console.error("[receiveAtHub] Transaction creation failed:", txnErr.message);
    }

    if (pr.pickupPartnerId) {
      const openCount = await PurchaseRequest.countDocuments({
        pickupPartnerId: pr.pickupPartnerId,
        status: { $in: ["pickup_assigned", "picked"] },
      });
      if (openCount === 0) {
        await PickupPartner.findByIdAndUpdate(pr.pickupPartnerId, {
          $set: { status: "available" },
        });
      }
    }

    return handleResponse(res, 200, "Items received at hub", { purchaseRequestId: pr._id });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const verifyInward = async (req, res) => {
  try {
    const { id } = req.params;
    const { verified = true, notes } = req.body || {};

    const pr = await PurchaseRequest.findById(id);
    if (!pr) return handleResponse(res, 404, "Purchase request not found");

    const inward = await HubInward.findOne({ purchaseRequestId: pr._id }).sort({
      createdAt: -1,
    });
    if (!inward) {
      return handleResponse(res, 404, "No hub inward record found");
    }

    inward.verificationStatus = verified ? "verified" : "rejected";
    inward.verifiedBy = req.user?.id || null;
    inward.verifiedByModel = "Admin";
    inward.verificationNotes = String(notes || "");
    await inward.save();
    pr.status = verified ? "verified" : "return_requested";
    if (!verified) {
      pr.returnDetails = {
        returnRequestedAt: new Date(),
        notes: String(notes || "QA Rejected inward")
      };
    }
    if (verified) pr.verifiedAt = new Date();
    if (notes !== undefined) pr.notes = String(notes || "");
    await savePurchaseRequest(pr);

    // Ownership transfers at QA pass — seller committed is released then.

    // Move stock from Reserved to Available in Hub Inventory
    if (verified && inward.receivedItems) {
      for (const item of inward.receivedItems) {
        const productId = String(item.productId?._id || item.productId);
        const acceptedQty = Number(item.acceptedQty || 0);
        const expectedQty = Number(item.expectedQty || acceptedQty);
        const rejectedQty = Math.max(0, expectedQty - acceptedQty);

        if (rejectedQty > 0) {
          pr.returnDetails = {
            returnRequestedAt: new Date(),
            notes: `QA partially rejected ${rejectedQty} units.`
          };
          // Standalone Manual PR must NEVER enter automated fallback / exhaustion
          // (null orderId would mass-close unrelated Manual PRs).
          if (pr.orderId) {
            try {
              const { fallbackPurchaseRequestLine } = await import('../services/purchaseRequestService.js');
              await fallbackPurchaseRequestLine(pr._id, productId, item.variantId || null, rejectedQty);
            } catch (e) {
              console.error("[verifyInward] Failed to trigger partial fallback PR:", e);
            }
          }
        }

        if (acceptedQty > 0) {
          const hubId = pr.hubId || DEFAULT_HUB_ID;
          const isStandaloneManual = !pr.orderId;

          if (pr.orderId) {
            await acceptQAInventory({
              productId,
              quantity: acceptedQty,
              hubId,
              orderId: pr.orderId,
              reason: "verify_inward_order_linked",
            });
          } else {
            // Manual PR: primary transfer is at Hub Receive.
            // Only re-run at QA when seller commit / PR line commit still remains
            // (legacy receive that skipped inventory). Avoids double-adding HA.
            const prLine = pr.items?.find((line) => {
              const lineProductId = String(line.productId?._id || line.productId);
              const lineSellerId = String(line.selectedSellerProductId || lineProductId);
              return (
                lineProductId === productId ||
                String(item.sellerProductId || "") === lineProductId ||
                String(item.sellerProductId || "") === lineSellerId
              );
            });
            const sellerProductId = prLine?.selectedSellerProductId
              ? String(prLine.selectedSellerProductId)
              : String(item.sellerProductId || productId);
            const sellerVariantId = prLine?.variantId || item.variantId || null;
            const lineCommitLeft = Math.max(0, Number(prLine?.committedQty || 0));

            let sellerCommitLeft = 0;
            try {
              const ProductModel = (await import("../models/product.js")).default;
              const sellerDoc = await ProductModel.findById(sellerProductId)
                .select("stock committedStock variants")
                .lean();
              if (sellerVariantId && Array.isArray(sellerDoc?.variants)) {
                const sv = sellerDoc.variants.find(
                  (v) => String(v._id) === String(sellerVariantId),
                );
                sellerCommitLeft = Math.max(0, Number(sv?.committedStock || 0));
              } else {
                sellerCommitLeft = Math.max(0, Number(sellerDoc?.committedStock || 0));
              }
            } catch (_) {
              sellerCommitLeft = lineCommitLeft;
            }

            if (lineCommitLeft > 0 || sellerCommitLeft > 0) {
              try {
                const { transferManualPRInventoryAtHubReceive } = await import(
                  "../services/manualPurchaseRequestInventoryService.js"
                );
                await transferManualPRInventoryAtHubReceive({
                  pr,
                  masterProductId: productId,
                  sellerProductId,
                  sellerVariantId,
                  acceptedQty: Math.min(
                    acceptedQty,
                    Math.max(lineCommitLeft, sellerCommitLeft, acceptedQty),
                  ),
                  hubId,
                });
              } catch (manualInvErr) {
                console.warn(
                  `[Inward] Manual PR transfer at QA failed:`,
                  manualInvErr.message,
                );
              }
            } else {
              console.log(
                `[Inward] Manual PR ${pr.requestId}: hub transfer already applied at receive; skipping QA inventory.`,
              );
            }
          }

          const hubRow = await HubInventory.findOne({ hubId, productId });
          if (hubRow) {
            // Re-sync price with Master Catalog just in case
            const masterProduct = await Product.findById(productId);
            if (masterProduct) {
              hubRow.sellPrice = masterProduct.price || masterProduct.salePrice || hubRow.sellPrice;

              // Propagation: Sync Master Price to all linked seller products (Downward Sync)
              const { propagatePriceUpdates } = await import('./productController.js');
              if (propagatePriceUpdates) {
                 await propagatePriceUpdates(masterProduct);
              }
              await hubRow.save();
            }

            if (pr.orderId) {
              const Order = (await import("../models/order.js")).default;
              await Order.updateOne(
                { _id: pr.orderId, "items.product": productId },
                { $inc: { "items.$.qaAcceptedQty": acceptedQty } }
              );
            }

            console.log(`[Inward] Verified stock for ${productId}: Moved ${acceptedQty} to ${ pr.orderId ? 'ReservedQty' : 'AvailableQty' }. New total: ${hubRow.availableQty}`);
          }

          // Release Seller Committed Stock (SC) — order-linked at QA; Manual at Hub Receive.
          try {
            const { moveSellerCommitToTransit } = await import("../services/inventory/inventoryEngine.js");
            const { resolveSellerVariantIdSync } = await import("../utils/productHelpers.js");
            const ProductModel = (await import("../models/product.js")).default;
            const prLine = pr.items?.find((line) => {
              const lineProductId = String(line.productId?._id || line.productId);
              const lineSellerId = String(line.selectedSellerProductId || lineProductId);
              return (
                lineProductId === productId ||
                String(item.sellerProductId || "") === lineProductId ||
                String(item.sellerProductId || "") === lineSellerId ||
                lineSellerId === String(item.sellerProductId || "")
              );
            });
            const sellerProductId = prLine?.selectedSellerProductId
              ? String(prLine.selectedSellerProductId)
              : String(item.sellerProductId || productId);

            if (sellerProductId && prLine) {
              let sellerVariantId = null;
              if (isStandaloneManual && prLine.variantId) {
                // Manual PR variantId is already the seller variant.
                sellerVariantId = prLine.variantId;
              } else if (prLine.variantId) {
                const [masterProduct, sellerProduct] = await Promise.all([
                  ProductModel.findById(prLine.productId).select("variants").lean(),
                  ProductModel.findById(sellerProductId).select("variants").lean(),
                ]);
                sellerVariantId = resolveSellerVariantIdSync({
                  masterProduct,
                  sellerProduct,
                  masterVariantId: prLine.variantId,
                });
              }

              if (!isStandaloneManual) {
                await moveSellerCommitToTransit({
                  productId: sellerProductId,
                  variantId: sellerVariantId,
                  quantity: acceptedQty,
                  sellerId: pr.vendorId,
                  orderId: pr.orderId,
                  reason: "verify_inward_qa_passed_seller_commit_release",
                });
                console.log(
                  `[Inward] Released SC for seller product ${sellerProductId}, Variant ${sellerVariantId}: -${acceptedQty} committedStock`,
                );
              }
              // Manual SC clear is inside transferManualPRInventoryAtHubReceive (idempotent).

              // Clear PR line commitment so UI no longer shows stale COMMITTED qty
              prLine.committedQty = Math.max(
                0,
                Number(prLine.committedQty || 0) - acceptedQty,
              );
            }
          } catch (scErr) {
            console.warn("[verifyInward] Failed to release seller committedStock (SC):", scErr.message);
          }

          if (pr.procurementSessionId) {
            const lineAllocId =
              pr.items?.find((row) => {
                const rowProductId = String(row.productId?._id || row.productId);
                return rowProductId === productId;
              })?.allocationId || pr.allocationId;
            if (lineAllocId) {
              await markAllocationCompletedFromInward({
                procurementSessionId: pr.procurementSessionId,
                allocationId: lineAllocId,
                completedQty: acceptedQty,
              });
            }
          }
        }
      }
    }

    // Persist any PR line committedQty updates from inventory transfer / QA clear
    await savePurchaseRequest(pr);

    // Financial Settlement: If verified, update the Pending transaction to 'Settled'
    if (pr.vendorId) {
      const existingTxn = await Transaction.findOne({
        user: pr.vendorId,
        reference: `PR-REC-${pr.requestId}`,
        status: "Pending"
      });

      if (verified) {
        if (existingTxn) {
          existingTxn.status = "Settled";
          existingTxn.meta.verifiedAt = new Date();
          await existingTxn.save();
          console.log(`[Settlement] Updated transaction to Settled for Seller ${pr.vendorId}: PR ${pr.requestId}`);
        } else {
          // Fallback: If for some reason receipt didn't create a txn, create it now
          let totalProcurementCost = (inward.receivedItems || []).reduce((acc, item) => {
            return acc + (Number(item.acceptedQty || 0) * Number(item.purchaseUnitCost || 0));
          }, 0);

          if (totalProcurementCost > 0) {
            await Transaction.create({
              user: pr.vendorId,
              userModel: "Seller",
              order: pr.orderId || undefined,
              type: "Supply Earning",
              amount: totalProcurementCost,
              status: "Settled",
              reference: `PR-SETTLE-${pr.requestId}`,
              meta: { purchaseRequestId: pr._id, verifiedAt: new Date() }
            });
          }
        }
      } else {
        // Verification failed, QA rejected. Cancel the pending transaction.
        if (existingTxn) {
          existingTxn.status = "Failed";
          existingTxn.meta.verifiedAt = new Date();
          existingTxn.meta.reason = "QA Rejected";
          await existingTxn.save();
          console.log(`[Settlement] Cancelled Pending transaction for Seller ${pr.vendorId}: PR ${pr.requestId} due to QA Rejection.`);
        }
      }
    }

    // If all purchase requests for this order are resolved, move order to packing-ready stage.
    const [parentOrder, siblingRequests] = await Promise.all([
      Order.findById(pr.orderId),
      PurchaseRequest.find({ orderId: pr.orderId }).select("status").lean(),
    ]);
    if (parentOrder) {
      let allDone =
        siblingRequests.length > 0 &&
        siblingRequests.every((row) => PR_DONE_STATUSES.has(String(row.status)));
      if (parentOrder.procurementSessionId) {
        const ProcurementSession = (await import("../models/procurementSession.js")).default;
        const ps = await ProcurementSession.findById(parentOrder.procurementSessionId).select("status").lean();
        if (ps?.status) {
          allDone = String(ps.status) === "completed";
        }
      }
      if (allDone) {
        markOrderReadyForPacking(parentOrder);
        await persistOrder(parentOrder);
        if (
          verified &&
          parentOrder.workflowVersion >= 2 &&
          parentOrder.hubFlowEnabled &&
          isOrderInventoryReadyForDelivery(parentOrder)
        ) {
          try {
            await startHubDeliverySearchAtomic(parentOrder.orderId);
          } catch (e) {
            console.warn(
              `[verifyInward] auto dispatch skipped for ${parentOrder.orderId}:`,
              e.message,
            );
          }
        }
      }
    }

    return handleResponse(res, 200, "Hub inward verification updated", {
      purchaseRequestId: pr._id,
      status: pr.status,
      verificationStatus: inward.verificationStatus,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getSellerPurchaseRequests = async (req, res) => {
  try {
    const sellerId = req.user?.id;
    const { status = "all" } = req.query || {};

    const query = { vendorId: sellerId };
    if (status !== "all") {
      query.status = String(status);
    }

    // We fetch and then filter to ensure we only show requests with VALID existing orders
    const rows = await PurchaseRequest.find(query)
      .populate({
        path: "orderId",
        select: "orderId status workflowStatus",
      })
      .populate("items.productId", "name mainImage unit")
      .populate("pickupPartnerId", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    // Filter out requests where order is missing or cancelled at the order level
    const filteredRows = rows.filter(row => {
      // If it's a manual admin PR (no orderId), show it
      if (!row.orderId && !row.requestId.includes("ORD")) return true;
      
      // If order is missing from DB or order status is cancelled, hide it from seller
      if (!row.orderId || row.orderId.status === "cancelled") return false;
      
      return true;
    });

    console.log("SELLER PR FETCH", sellerId, rows.length);
    const mapped = filteredRows.map(mapSellerRow);
    console.log("SELLER PR MAPPED", mapped.map(m => m.requestId));

    return handleResponse(res, 200, "Seller purchase requests fetched", {
      items: mapped,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const respondSellerPurchaseRequest = async (req, res) => {
  try {
    const sellerId = req.user?.id;
    const { id } = req.params;
    const {
      action = "accept",
      notes = "",
      rejectionReason = "",
      items = [],
      productId: lineProductId,
      variantId: lineVariantId = null,
      committedQty: lineCommittedQty,
    } = req.body || {};

    const pr = await PurchaseRequest.findOne({ _id: id, vendorId: sellerId }).populate(
      "items.productId",
      "name",
    );
    if (!pr) return handleResponse(res, 404, "Purchase request not found");

    // Standalone Manual PRs must use /manual/:id/respond (inventory-safe, no auto-fallback).
    const { isStandaloneManualPR } = await import("../services/manualPurchaseRequestInventoryService.js");
    if (isStandaloneManualPR(pr)) {
      return handleResponse(
        res,
        400,
        "Standalone manual purchase requests must be answered via the Manual PR respond endpoint",
      );
    }

    if (!["created", "seller_confirmed", "pickup_assigned", "vendor_confirmed"].includes(String(pr.status))) {
      return handleResponse(
        res,
        400,
        "Purchase request is not open for seller response",
      );
    }

    const isMultiLine = (pr.items || []).length > 1;
    const normalizedAction = String(action).toLowerCase();

    if (!["accept", "reject", "partial", "accept_line", "reject_line"].includes(normalizedAction)) {
      return handleResponse(res, 400, "Invalid action");
    }

    // Per-line response for multi-product purchase requests
    if (isMultiLine && ["accept_line", "reject_line"].includes(normalizedAction)) {
      if (!lineProductId) {
        return handleResponse(res, 400, "productId is required for line-level response");
      }

      const targetLine = findPrLine(pr, lineProductId, lineVariantId);
      if (!targetLine) {
        return handleResponse(res, 404, "Product line not found in this request");
      }

      const currentLine = normalizePrLine(targetLine);
      if (currentLine.lineStatus && currentLine.lineStatus !== "pending") {
        return handleResponse(res, 400, "This product line has already been responded to");
      }

      const requestedQty = Number(currentLine.requestedQty || currentLine.shortageQty || 0);
      let committedQty = 0;
      if (normalizedAction === "reject_line") {
        committedQty = 0;
      } else {
        committedQty =
          lineCommittedQty !== undefined
            ? Math.min(requestedQty, Math.max(0, Number(lineCommittedQty || 0)))
            : requestedQty;
        if (committedQty <= 0) {
          return handleResponse(
            res,
            400,
            "committedQty must be at least 1 to accept a line, or use reject_line",
          );
        }
      }

      const updatedLine = applyLineSellerQuantities(currentLine, committedQty);
      pr.items = (pr.items || []).map((line) => {
        const row = normalizePrLine(line);
        const key = row.itemKey || buildPrLineKey(row.productId, row.variantId);
        return key === updatedLine.itemKey ? updatedLine : row;
      });

      syncPrAggregateStatus(pr, { notes, rejectionReason, sellerId });
      await savePurchaseRequest(pr);

      const allocId = updatedLine.allocationId || pr.allocationId;
      if (pr.procurementSessionId && allocId) {
        await markAllocationFromSellerResponse({
          procurementSessionId: pr.procurementSessionId,
          allocationId: allocId,
          responseStatus:
            updatedLine.lineStatus === "accepted"
              ? "accepted"
              : updatedLine.lineStatus === "partial"
                ? "partial"
                : "rejected",
          committedQty: Number(updatedLine.committedQty || 0),
        });
        await evaluateProcurementSessionCompletion(pr.procurementSessionId);
      }

      if (isRetryEligibleLineStatus(updatedLine.lineStatus)) {
        try {
          const { fallbackPurchaseRequestLine } = await import("../services/purchaseRequestService.js");
          const retryQty = Number(updatedLine.remainingQty || 0);
          if (retryQty > 0) {
            const releaseQty =
              updatedLine.lineStatus === "partial"
                ? retryQty
                : Math.max(0, Number(updatedLine.requestedQty || updatedLine.shortageQty || 0));
            if (pr.procurementSessionId && allocId) {
              await releaseAllocationSellerStock({
                procurementSessionId: pr.procurementSessionId,
                allocationId: allocId,
                purchaseRequestId: pr._id,
                orderId: pr.orderId || null,
                quantity: releaseQty,
                eventType: "SELLER_REJECTED",
                reason:
                  updatedLine.lineStatus === "rejected"
                    ? "seller_line_rejected"
                    : "seller_line_partial_release",
                actor: { id: sellerId, type: "seller" },
                transactionId: `pr_release:${String(pr._id)}:${String(allocId)}:${releaseQty}`,
              });
            }
            await fallbackPurchaseRequestLine(
              pr._id,
              updatedLine.productId,
              updatedLine.variantId || null,
              retryQty,
            );
          }
        } catch (err) {
          console.warn("[Line Fallback] Failed:", err.message);
        }
      }

      if (isPickupEligibleLine(updatedLine)) {
        try {
          await maybeAssignPickup(pr);
        } catch (assignErr) {
          console.warn("[PickupAssign] Line accept failed:", assignErr.message);
        }
      }

      const refreshed = await PurchaseRequest.findById(pr._id)
        .populate("items.productId", "name")
        .lean();
      return handleResponse(res, 200, "Product line response saved", mapSellerRow(refreshed));
    }

    if (isMultiLine) {
      return handleResponse(
        res,
        400,
        "Multi-product requests require per-line actions. Use accept_line or reject_line for each product.",
      );
    }

    // Single-line purchase request flow
    if (normalizedAction === "reject") {
      pr.vendorResponse = {
        status: "rejected",
        respondedAt: new Date(),
        rejectionReason: String(rejectionReason || "Rejected by seller"),
        notes: String(notes || ""),
      };
      pr.status = "seller_rejected";
      pr.exceptionReason = String(rejectionReason || "Rejected by seller");
      pr.items = (pr.items || []).map((line) => {
        const updated = applyLineSellerQuantities(line, 0);
        return updated;
      });
      await savePurchaseRequest(pr);

      try {
        const { fallbackPurchaseRequest } = await import("../services/purchaseRequestService.js");
        if (pr.procurementSessionId && pr.allocationId) {
          await markAllocationFromSellerResponse({
            procurementSessionId: pr.procurementSessionId,
            allocationId: pr.allocationId,
            responseStatus: "rejected",
            committedQty: 0,
          });
          await releaseAllocationSellerStock({
            procurementSessionId: pr.procurementSessionId,
            allocationId: pr.allocationId,
            purchaseRequestId: pr._id,
            orderId: pr.orderId || null,
            eventType: "SELLER_REJECTED",
            reason: "seller_rejected",
            actor: { id: sellerId, type: "seller" },
            transactionId: `pr_release:${String(pr._id)}:${String(pr.allocationId)}`,
          });
        }
        await fallbackPurchaseRequest(pr._id);
      } catch (err) {
        console.warn("[Auto Fallback] Failed to trigger fallback on rejection:", err.message);
      }

      return handleResponse(res, 200, "Purchase request rejected", mapSellerRow(pr.toObject()));
    }

    const incomingMap = new Map(
      (Array.isArray(items) ? items : [])
        .filter((row) => row && row.productId != null)
        .map((row) => {
          const key = row.variantId
            ? buildPrLineKey(row.productId, row.variantId)
            : String(row.productId);
          return [key, Number(row.committedQty || 0)];
        }),
    );

    let fullyCommitted = true;
    let anyCommitted = false;
    pr.items = (pr.items || []).map((line) => {
      const row = normalizePrLine(line);
      const shortage = Number(row.requestedQty || row.shortageQty || 0);
      const lineKey = row.itemKey || buildPrLineKey(row.productId, row.variantId);
      let committedQty = shortage;
      if (incomingMap.has(lineKey)) {
        committedQty = Math.min(shortage, Math.max(0, incomingMap.get(lineKey)));
      } else if (incomingMap.has(String(row.productId))) {
        committedQty = Math.min(shortage, Math.max(0, incomingMap.get(String(row.productId))));
      } else if (normalizedAction === "partial") {
        committedQty = Number(row.committedQty || 0);
      }
      if (committedQty < shortage) fullyCommitted = false;
      if (committedQty > 0) anyCommitted = true;
      return applyLineSellerQuantities(row, committedQty);
    });

    const responseStatus = fullyCommitted
      ? "accepted"
      : anyCommitted
        ? "partial"
        : "rejected";
    const committedQtyTotal = (pr.items || []).reduce(
      (sum, line) => sum + Math.max(0, Number(line.committedQty || 0)),
      0,
    );

    pr.vendorResponse = {
      status: responseStatus,
      respondedAt: new Date(),
      rejectionReason: responseStatus === "rejected" ? "No quantity committed" : "",
      notes: String(notes || ""),
    };
    pr.status = responseStatus === "rejected" ? "seller_rejected" : "seller_confirmed";
    pr.exceptionReason = "";
    await savePurchaseRequest(pr);

    if (pr.procurementSessionId && pr.allocationId) {
      await markAllocationFromSellerResponse({
        procurementSessionId: pr.procurementSessionId,
        allocationId: pr.allocationId,
        responseStatus,
        committedQty: committedQtyTotal,
      });
    }

    if (responseStatus === "rejected") {
      try {
        const { fallbackPurchaseRequest } = await import("../services/purchaseRequestService.js");
        if (pr.procurementSessionId && pr.allocationId) {
          await releaseAllocationSellerStock({
            procurementSessionId: pr.procurementSessionId,
            allocationId: pr.allocationId,
            purchaseRequestId: pr._id,
            orderId: pr.orderId || null,
            eventType: "SELLER_REJECTED",
            reason: "seller_rejected_zero_commit",
            actor: { id: sellerId, type: "seller" },
            transactionId: `pr_release:${String(pr._id)}:${String(pr.allocationId)}:zero`,
          });
        }
        await fallbackPurchaseRequest(pr._id);
      } catch (err) {
        console.warn("[Auto Fallback] Failed after zero-commit reject:", err.message);
      }
    } else if (responseStatus === "partial") {
      try {
        const { fallbackPurchaseRequest } = await import("../services/purchaseRequestService.js");
        const remainingToRetry = Math.max(
          0,
          (pr.items || []).reduce(
            (sum, line) => sum + Math.max(0, Number(line.remainingQty || 0)),
            0,
          ),
        );
        if (remainingToRetry > 0) {
          if (pr.procurementSessionId && pr.allocationId) {
            await releaseAllocationSellerStock({
              procurementSessionId: pr.procurementSessionId,
              allocationId: pr.allocationId,
              purchaseRequestId: pr._id,
              orderId: pr.orderId || null,
              quantity: remainingToRetry,
              eventType: "SELLER_REJECTED",
              reason: "seller_partial_uncommitted_release",
              actor: { id: sellerId, type: "seller" },
              transactionId: `pr_release:${String(pr._id)}:${String(pr.allocationId)}:${remainingToRetry}`,
            });
          }
          await fallbackPurchaseRequest(pr._id, remainingToRetry);
        }
      } catch (err) {
        console.warn("[Auto Fallback] Failed to trigger fallback on partial response:", err.message);
      }
    }

    if (responseStatus === "accepted" || responseStatus === "partial") {
      try {
        await maybeAssignPickup(pr);
      } catch (assignErr) {
        console.warn("[PickupAssign] Failed after seller response:", assignErr.message);
      }
    }

    const refreshed = await PurchaseRequest.findById(pr._id)
      .populate("items.productId", "name")
      .lean();
    return handleResponse(
      res,
      200,
      "Seller response saved and pickup request triggered",
      mapSellerRow(refreshed),
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const markSellerRequestReady = async (req, res) => {
  try {
    const sellerId = req.user?.id;
    const { id } = req.params;
    const { notes = "" } = req.body || {};

    const pr = await PurchaseRequest.findOne({ _id: id, vendorId: sellerId }).lean();
    if (!pr) return handleResponse(res, 404, "Purchase request not found");

    if (!["created", "seller_confirmed", "vendor_confirmed", "pickup_assigned"].includes(String(pr.status))) {
      return handleResponse(
        res,
        400,
        "Request must be created or seller-confirmed before marking ready",
      );
    }

    const doc = await PurchaseRequest.findById(id).populate("items.productId", "name");
    if (!doc) return handleResponse(res, 404, "Purchase request not found");

    doc.vendorReadyAt = new Date();
    doc.vendorReadyNotes = String(notes || "");
    if (String(doc.vendorResponse?.status || "pending") === "pending") {
      doc.vendorResponse = {
        status: "accepted",
        respondedAt: new Date(),
        rejectionReason: "",
        notes: String(notes || ""),
      };
      if (String(doc.status) === "created") {
        doc.status = "seller_confirmed";
      }
    }
    let autoAssigned = false;

    if (!doc.pickupPartnerId) {
      const partner = await pickBestPickupPartner(doc.hubId || DEFAULT_HUB_ID);
      if (partner) {
        await assignPickupToRequest(doc, partner);
        autoAssigned = true;
      } else {
        doc.status = "exception";
        doc.exceptionReason = "No pickup partners available";
        await savePurchaseRequest(doc);
        try {
          const { createNotification } = await import("../services/notificationService.js");
          const Admin = (await import("../models/admin.js")).default;
          const admins = await Admin.find({}).select("_id").lean();
          for (const admin of admins) {
            await createNotification({
              recipient: admin._id,
              recipientModel: "Admin",
              title: "Pickup Assignment Failed",
              message: `No pickup partners available for PR ${doc.requestId}.`,
              type: "system",
            });
          }
        } catch (e) { console.error("[markReady] Failed to notify admins:", e); }
      }
    } else {
      await savePurchaseRequest(doc);
    }

    const updated = await PurchaseRequest.findById(id)
      .populate("orderId", "orderId")
      .populate("items.productId", "name")
      .populate("pickupPartnerId", "name phone")
      .lean();

    return handleResponse(res, 200, "Marked ready for pickup", {
      ...mapSellerRow(updated),
      autoPickupAssigned: autoAssigned,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const confirmSellerHandover = async (req, res) => {
  try {
    const sellerId = req.user?.id;
    const { id } = req.params;
    const { otp, notes = "" } = req.body || {};

    if (!otp) return handleResponse(res, 400, "Pickup OTP is required");

    const pr = await PurchaseRequest.findOne({ _id: id, vendorId: sellerId }).populate(
      "items.productId",
      "name",
    );
    if (!pr) return handleResponse(res, 404, "Purchase request not found");

    if (String(pr.status) !== "pickup_assigned") {
      return handleResponse(
        res,
        400,
        "Pickup partner must be assigned before handover",
      );
    }

    const expectedHash = pr.pickupOtpHash || "";
    if (!expectedHash || expectedHash !== hashPickupOtp(otp)) {
      return handleResponse(res, 400, "Invalid pickup OTP");
    }
    if (pr.pickupOtpExpiresAt && new Date(pr.pickupOtpExpiresAt) < new Date()) {
      return handleResponse(res, 400, "Pickup OTP expired");
    }

    pr.vendorHandover = {
      confirmedAt: new Date(),
      otpVerifiedAt: new Date(),
      notes: String(notes || ""),
    };
    pr.pickupOtpVerifiedAt = new Date();
    await savePurchaseRequest(pr);

    return handleResponse(
      res,
      200,
      "Handover OTP verified. Waiting pickup partner confirmation.",
      mapSellerRow(pr.toObject()),
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ==========================================
// REVERSE LOGISTICS (QA Rejection Returns)
// ==========================================

export const assignReturnPickup = async (req, res) => {
  try {
    const { id } = req.params; // PR id
    const { pickupPartnerId } = req.body;

    const pr = await PurchaseRequest.findById(id);
    if (!pr) return handleResponse(res, 404, "Purchase request not found");

    if (pr.status !== "return_requested") {
      return handleResponse(res, 400, "PR is not in return_requested status");
    }

    if (!pr.returnDetails) {
      pr.returnDetails = {};
    }

    pr.returnDetails.returnPickupPartnerId = pickupPartnerId;
    pr.status = "return_pickup";
    await savePurchaseRequest(pr);

    return handleResponse(res, 200, "Return pickup partner assigned", pr);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const markReturnDelivered = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pr = await PurchaseRequest.findById(id);
    if (!pr) return handleResponse(res, 404, "Purchase request not found");

    if (pr.status !== "return_pickup") {
      return handleResponse(res, 400, "PR is not in return_pickup status");
    }

    pr.returnDetails.returnDeliveredAt = new Date();
    pr.status = "return_delivered";
    await savePurchaseRequest(pr);

    return handleResponse(res, 200, "Return marked as delivered to vendor", pr);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const confirmVendorReturn = async (req, res) => {
  try {
    const { id } = req.params;

    const pr = await PurchaseRequest.findById(id);
    if (!pr) return handleResponse(res, 404, "Purchase request not found");

    if (pr.status !== "return_delivered") {
      return handleResponse(res, 400, "PR is not in return_delivered status");
    }

    pr.returnDetails.sellerConfirmedReturnAt = new Date();
    pr.status = "seller_confirmed_return";
    await savePurchaseRequest(pr);

    // --- RESTORE STOCK ---
    try {
      const { restoreSellerInventory } = await import("../services/inventory/inventoryEngine.js");
      for (const item of pr.items) {
        if (item.productId && item.actualPickedQty > 0) {
          const sellerProductId = item.selectedSellerProductId || item.productId;
          const restoreQty = Number(item.actualPickedQty);
          await restoreSellerInventory({
            productId: sellerProductId,
            variantId: item.variantId || null,
            quantity: restoreQty,
            orderId: pr.orderId,
            sellerId: pr.vendorId,
            reason: "vendor_return_confirmed",
            idempotencyKey: `vendor_return:${String(pr._id)}:${String(item.allocationId || item.productId)}:${restoreQty}`,
          });
          console.log(`[Reverse Logistics] Restored ${item.actualPickedQty} to Seller ${pr.vendorId}`);
        }
      }
    } catch (err) {
      console.warn("[Reverse Logistics] Failed to restore seller stock:", err.message);
    }

    return handleResponse(res, 200, "Return confirmed and stock restored", pr);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ==========================================
// STANDALONE MANUAL PR IMPLEMENTATION
// ==========================================

const manualPrHttpError = (statusCode, message, data) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (data !== undefined) err.data = data;
  return err;
};

/**
 * Shared transactional create for standalone Manual PR (all create paths).
 * Commits every line inside one Mongo session — no partial commits.
 */
export const createStandaloneManualPRCore = async ({
  vendorId,
  items,
  hubId = DEFAULT_HUB_ID,
  notes = "",
}) => {
  if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
    throw manualPrHttpError(400, "Valid vendorId is required");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw manualPrHttpError(400, "A non-empty items array is required");
  }

  const vendor = await Seller.findById(vendorId).select("_id shopName name");
  if (!vendor) throw manualPrHttpError(404, "Vendor not found");

  const { getSellerResponseTimeoutMinutes } = await import("../services/settingsService.js");
  const timeoutMinutes = (await getSellerResponseTimeoutMinutes()) || 120;
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

  const prItems = [];
  for (const item of items) {
    const { productId, variantId, quantity } = item || {};
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      throw manualPrHttpError(400, "Valid productId is required for each item");
    }
    const qty = Math.max(1, Number(quantity || 0));
    if (!Number.isFinite(qty) || qty <= 0) {
      throw manualPrHttpError(400, "Valid quantity is required for each item");
    }

    const product = await Product.findById(productId).select(
      "_id name status stock committedStock price salePrice purchasePrice gstRate variants",
    );
    if (!product) throw manualPrHttpError(404, `Product not found: ${productId}`);

    const variantRows = Array.isArray(product.variants) ? product.variants : [];
    const targetVariant =
      variantId && variantRows.length
        ? variantRows.find((v) => String(v._id) === String(variantId))
        : null;
    if (variantRows.length > 0 && !targetVariant) {
      throw manualPrHttpError(
        400,
        `variantId is required for variant-based product: ${product.name}`,
      );
    }

    // stock field is available qty after prior commits (commit does stock-= / committed+=).
    const sellerStock = targetVariant
      ? Math.max(0, Number(targetVariant.stock) || 0)
      : Math.max(0, Number(product.stock) || 0);

    if (qty > sellerStock) {
      throw manualPrHttpError(
        400,
        `Requested quantity for ${product.name} exceeds available stock (${sellerStock} available).`,
      );
    }

    const activeQuery = {
      vendorId,
      status: {
        $in: [
          "created",
          "seller_confirmed",
          "pickup_assigned",
          "picked",
          "hub_delivered",
          "received_at_hub",
        ],
      },
      items: {
        $elemMatch: targetVariant
          ? { productId: product._id, variantId: targetVariant._id }
          : { productId: product._id },
      },
    };
    const activePr = await PurchaseRequest.findOne(activeQuery).select("requestId");
    if (activePr) {
      throw manualPrHttpError(
        409,
        `An active purchase request (${activePr.requestId}) already exists for this product: ${product.name}`,
        { requestId: activePr.requestId },
      );
    }

    const unitCost = targetVariant
      ? toMoney(
          Number(targetVariant.purchasePrice ?? targetVariant.price) ||
            product?.purchasePrice ||
            product?.price ||
            0,
        )
      : toMoney(product?.purchasePrice || product?.salePrice || product?.price || 0);

    const itemNotes = item?.notes ? String(item.notes).trim() : "";

    prItems.push({
      productId: product._id,
      variantId: targetVariant ? targetVariant._id : undefined,
      selectedSellerProductId: product._id,
      requiredQty: qty,
      availableQtyAtHub: 0,
      shortageQty: qty,
      requestedQty: qty,
      remainingQty: qty,
      // Inventory is committed at create — keep line field in sync.
      committedQty: qty,
      vendorUnitCost: unitCost,
      vendorQuotedPrice: unitCost,
      pricingStrategy: "standalone_manual_request",
      gstRate: product.gstRate || 0,
      gstAmount: Math.round(unitCost * qty * ((product.gstRate || 0) / 100)),
      baseSupplyPrice: unitCost,
      finalSupplyPrice: unitCost + Math.round(unitCost * ((product.gstRate || 0) / 100)),
      totalProcurementCost:
        (unitCost + Math.round(unitCost * ((product.gstRate || 0) / 100))) * qty,
      notes: itemNotes,
    });
  }

  const session = await mongoose.startSession();
  let doc;
  try {
    session.startTransaction();

    const created = await PurchaseRequest.create(
      [
        {
          requestId: generateRequestId(),
          orderId: null,
          // No procurementSessionId / allocationId — Manual PR is not session-backed.
          // Omitting avoids sparse unique index collisions on (null, null).
          hubId: String(hubId || DEFAULT_HUB_ID),
          vendorId: vendor._id,
          items: prItems,
          status: "created",
          expiresAt,
          requestType: "manual",
          notes: notes ? String(notes) : undefined,
        },
      ],
      { session },
    );
    doc = created[0];

    const { commitSellerInventory } = await import("../services/inventory/inventoryEngine.js");
    for (const item of prItems) {
      await commitSellerInventory({
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.requiredQty,
        sellerId: vendor._id,
        reason: "manual_pr_create",
        idempotencyKey: `manual_pr_commit:${String(doc._id)}:${String(item.productId)}:${item.variantId || "novar"}:${item.requiredQty}`,
        session,
      });
    }

    await session.commitTransaction();
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }

  try {
    const { createNotification } = await import("../services/notificationService.js");
    await createNotification({
      recipient: vendor._id,
      recipientModel: "Seller",
      title: "New Manual Purchase Request",
      message: `You have received a new manual purchase request ${doc.requestId}.`,
      type: "manual_pr_created",
      data: { purchaseRequestId: doc._id.toString(), requestId: doc.requestId },
    });
  } catch (notifErr) {
    console.error("[createStandaloneManualPRCore] Notification failed:", notifErr.message);
  }

  const hydrated = await PurchaseRequest.findById(doc._id)
    .populate("vendorId", "shopName name")
    .populate("items.productId", "name")
    .lean();

  return { doc, hydrated };
};

export const createManualPR = async (req, res) => {
  try {
    const { vendorId, items, hubId, notes } = req.body || {};
    const result = await createStandaloneManualPRCore({
      vendorId,
      items,
      hubId,
      notes,
    });
    return handleResponse(
      res,
      201,
      "Manual purchase request created successfully",
      result.hydrated,
    );
  } catch (error) {
    const status = error?.statusCode || 500;
    return handleResponse(res, status, error.message, error?.data);
  }
};

export const respondToManualPR = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { action, notes } = req.body || {};
    const sellerId = req.user?.id;

    if (!["accept", "reject"].includes(String(action).toLowerCase())) {
      return handleResponse(res, 400, "Action must be accept or reject");
    }

    const {
      assertStandaloneManualPR,
      releaseAllManualPRCommitments,
    } = await import("../services/manualPurchaseRequestInventoryService.js");

    const pr = await PurchaseRequest.findOne({ _id: id, vendorId: sellerId });
    if (!pr) return handleResponse(res, 404, "Manual purchase request not found");
    assertStandaloneManualPR(pr);

    if (pr.status !== "created") {
      return handleResponse(res, 400, "Purchase request is not open for response");
    }

    if (pr.expiresAt && new Date(pr.expiresAt).getTime() <= Date.now()) {
      return handleResponse(res, 400, "Purchase request has expired");
    }

    const isReject = String(action).toLowerCase() === "reject";

    if (isReject) {
      session.startTransaction();

      await releaseAllManualPRCommitments({
        pr,
        session,
        reason: "manual_pr_rejected_by_seller",
        action: "reject",
      });

      pr.status = "seller_rejected";
      pr.vendorResponse = {
        status: "rejected",
        respondedAt: new Date(),
        rejectionReason: notes || "Rejected by seller",
      };
      for (const item of pr.items || []) {
        item.lineStatus = "rejected";
        item.committedQty = 0;
        item.remainingQty = 0;
      }
      await pr.save({ session });
      await session.commitTransaction();

      try {
        const { createNotification, createNotificationBatch } = await import(
          "../services/notificationService.js"
        );
        const admins = await mongoose.model("Admin").find({}).select("_id").lean();
        const adminIds = admins.map((a) => a?._id).filter(Boolean);

        if (adminIds.length) {
          await createNotificationBatch(
            adminIds.map((adminId) => ({
              recipient: adminId,
              recipientModel: "Admin",
              title: "Manual PR Rejected",
              message: `Manual purchase request ${pr.requestId} was rejected by the seller.`,
              type: "manual_pr_rejected",
              data: { purchaseRequestId: pr._id.toString(), requestId: pr.requestId },
            })),
          );
        }

        await createNotification({
          recipient: sellerId,
          recipientModel: "Seller",
          title: "Inventory Released",
          message: `Stock committed for purchase request ${pr.requestId} has been released.`,
          type: "manual_pr_inventory_released",
          data: { purchaseRequestId: pr._id.toString() },
        });
      } catch (notifErr) {
        console.error("[respondToManualPR] Notifications failed:", notifErr.message);
      }

      return handleResponse(res, 200, "Purchase request rejected", pr);
    }

    // Accept — inventory already committed at create; status only.
    pr.status = "seller_confirmed";
    pr.vendorResponse = {
      status: "accepted",
      respondedAt: new Date(),
      notes: notes || "",
    };
    pr.items = pr.items.map((line) => {
      line.committedQty = Number(line.requestedQty || line.shortageQty || line.committedQty || 0);
      line.remainingQty = 0;
      line.lineStatus = "accepted";
      return line;
    });
    await savePurchaseRequest(pr);

    try {
      await maybeAssignPickup(pr);
    } catch (assignErr) {
      console.warn("[respondToManualPR] Pickup assignment failed:", assignErr.message);
    }

    try {
      const { createNotificationBatch } = await import("../services/notificationService.js");
      const admins = await mongoose.model("Admin").find({}).select("_id").lean();
      const adminIds = admins.map((a) => a?._id).filter(Boolean);

      if (adminIds.length) {
        await createNotificationBatch(
          adminIds.map((adminId) => ({
            recipient: adminId,
            recipientModel: "Admin",
            title: "Manual PR Accepted",
            message: `Manual purchase request ${pr.requestId} was accepted by the seller.`,
            type: "manual_pr_accepted",
            data: { purchaseRequestId: pr._id.toString(), requestId: pr.requestId },
          })),
        );
      }
    } catch (notifErr) {
      console.error("[respondToManualPR] Accepted notification failed:", notifErr.message);
    }

    const refreshed = await PurchaseRequest.findById(pr._id)
      .populate("items.productId", "name")
      .populate("pickupPartnerId", "name phone")
      .lean();

    return handleResponse(res, 200, "Purchase request accepted", refreshed);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    const status = error?.statusCode || 500;
    return handleResponse(res, status, error.message);
  } finally {
    await session.endSession();
  }
};

export const updateManualPRStatus = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (String(status).toLowerCase() !== "cancelled") {
      return handleResponse(res, 400, "Only cancellation is supported through this endpoint");
    }

    const {
      assertStandaloneManualPR,
      MANUAL_PR_PRE_PICKUP_STATUSES,
      MANUAL_PR_TERMINAL_STATUSES,
      releaseAllManualPRCommitments,
    } = await import("../services/manualPurchaseRequestInventoryService.js");

    const pr = await PurchaseRequest.findById(id);
    if (!pr) return handleResponse(res, 404, "Manual purchase request not found");
    assertStandaloneManualPR(pr);

    if (MANUAL_PR_TERMINAL_STATUSES.has(pr.status)) {
      return handleResponse(res, 400, "Purchase request is already in a terminal state");
    }

    // Pickup already started — do NOT restore seller inventory (prevents double ownership).
    if (!MANUAL_PR_PRE_PICKUP_STATUSES.has(String(pr.status))) {
      return handleResponse(
        res,
        400,
        "Cannot cancel Manual PR after pickup has started. Inventory ownership must follow pickup/QA lifecycle.",
      );
    }

    session.startTransaction();

    await releaseAllManualPRCommitments({
      pr,
      session,
      reason: "manual_pr_cancelled_by_admin",
      action: "cancel",
    });

    pr.status = "cancelled";
    await pr.save({ session });
    await session.commitTransaction();

    try {
      const { createNotification } = await import("../services/notificationService.js");
      await createNotification({
        recipient: pr.vendorId,
        recipientModel: "Seller",
        title: "Manual PR Cancelled",
        message: `Manual purchase request ${pr.requestId} has been cancelled by the admin.`,
        type: "manual_pr_cancelled",
        data: { purchaseRequestId: pr._id.toString() },
      });
      await createNotification({
        recipient: pr.vendorId,
        recipientModel: "Seller",
        title: "Inventory Released",
        message: `Stock committed for purchase request ${pr.requestId} has been released.`,
        type: "manual_pr_inventory_released",
        data: { purchaseRequestId: pr._id.toString() },
      });
    } catch (notifErr) {
      console.error("[updateManualPRStatus] Notifications failed:", notifErr.message);
    }

    return handleResponse(res, 200, "Manual purchase request cancelled successfully", pr);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    const statusCode = error?.statusCode || 500;
    return handleResponse(res, statusCode, error.message);
  } finally {
    await session.endSession();
  }
};

/**
 * Atomic Manual PR expiry: release ALL lines + set expired in one transaction.
 * Used by procurementMonitorJob Manual branch only.
 * @deprecated prefer import from manualPurchaseRequestInventoryService
 */
export { expireStandaloneManualPR } from "../services/manualPurchaseRequestInventoryService.js";

