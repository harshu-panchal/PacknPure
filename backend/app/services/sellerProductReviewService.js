import Admin from "../models/admin.js";
import Notification from "../models/notification.js";
import Product from "../models/product.js";
import Seller from "../models/seller.js";
import { createNotificationBatch } from "./notificationService.js";
import {
  catalogStockFromProduct,
  resolveSupplyPriceFromInput,
  resolveSupplyPriceFromVariantRow,
} from "../utils/productHelpers.js";

function toPlain(product) {
  return typeof product?.toObject === "function" ? product.toObject() : { ...product };
}

/** Snapshot supply price + stock for change detection. */
export function captureSellerListingSnapshot(product) {
  const plain = toPlain(product);
  const variants = (plain.variants || []).map((v) => ({
    name: String(v?.name || "").trim().toLowerCase(),
    supply: resolveSupplyPriceFromVariantRow(v, resolveSupplyPriceFromInput(plain)),
    stock: Math.max(0, Number(v?.stock) || 0),
  }));

  return {
    supplyPrice: resolveSupplyPriceFromInput(plain),
    stock: catalogStockFromProduct(plain),
    variants,
  };
}

export function detectSellerListingChanges(before, after) {
  const types = [];

  if (Number(before?.supplyPrice) !== Number(after?.supplyPrice)) {
    types.push("supply_price");
  }

  if (Number(before?.stock) !== Number(after?.stock)) {
    types.push("stock");
  }

  const beforeMap = new Map((before?.variants || []).map((v) => [v.name, v]));
  for (const av of after?.variants || []) {
    const bv = beforeMap.get(av.name);
    if (!bv) continue;
    if (Number(bv.supply) !== Number(av.supply) && !types.includes("supply_price")) {
      types.push("supply_price");
    }
    if (Number(bv.stock) !== Number(av.stock) && !types.includes("stock")) {
      types.push("stock");
    }
  }

  return types;
}

function buildReviewSummary(types, before, after, productName) {
  const parts = [];
  if (types.includes("supply_price")) {
    parts.push(`supply ₹${before.supplyPrice} → ₹${after.supplyPrice}`);
  }
  if (types.includes("stock")) {
    parts.push(`stock ${before.stock} → ${after.stock}`);
  }
  return `${productName}: ${parts.join(", ")}`;
}

export function shouldTrackSellerReview(product) {
  const plain = toPlain(product);
  return (
    plain.ownerType === "seller" &&
    plain.status === "active" &&
    Boolean(plain.masterProductId)
  );
}

export async function markSellerListingForAdminReview(product, types, before, after) {
  if (!types?.length || !shouldTrackSellerReview(product)) return null;

  const plain = toPlain(product);
  const summary = buildReviewSummary(types, before, after, plain.name);

  const patch = {
    "adminReview.pending": true,
    "adminReview.types": types,
    "adminReview.updatedAt": new Date(),
    "adminReview.summary": summary,
    "adminReview.previousSupplyPrice": before.supplyPrice,
    "adminReview.newSupplyPrice": after.supplyPrice,
    "adminReview.previousStock": before.stock,
    "adminReview.newStock": after.stock,
  };

  await Product.findByIdAndUpdate(plain._id, { $set: patch });
  return summary;
}

export async function clearSellerListingAdminReview(productId) {
  if (!productId) return;
  await Product.findByIdAndUpdate(productId, {
    $set: {
      adminReview: {
        pending: false,
        types: [],
        updatedAt: null,
        summary: null,
        previousSupplyPrice: null,
        newSupplyPrice: null,
        previousStock: null,
        newStock: null,
      },
    },
  });
}

export async function clearAdminReviewForMasterListings(masterProductId) {
  if (!masterProductId) return;
  await Product.updateMany(
    { masterProductId, ownerType: "seller" },
    {
      $set: {
        adminReview: {
          pending: false,
          types: [],
          updatedAt: null,
          summary: null,
          previousSupplyPrice: null,
          newSupplyPrice: null,
          previousStock: null,
          newStock: null,
        },
      },
    },
  );
}

export async function notifyAdminsSellerListingUpdated(product, types, summary) {
  if (!types?.length) return;

  try {
    const plain = toPlain(product);
    const seller = await Seller.findById(plain.sellerId).select("shopName name").lean();
    const vendorName = seller?.shopName || seller?.name || "Vendor";
    const admins = await Admin.find({}, "_id").lean();

    const priceChanged = types.includes("supply_price");
    const stockChanged = types.includes("stock");
    const title = priceChanged
      ? "Seller updated supply price"
      : stockChanged
        ? "Seller updated stock"
        : "Seller product updated";

    let message = `${vendorName} updated "${plain.name}".`;
    if (summary) message += ` ${summary}.`;
    if (priceChanged) {
      message += " Review and update customer catalog pricing.";
    }

    const notifications = admins.map((admin) => ({
      recipient: admin._id,
      recipientModel: "Admin",
      title,
      message,
      type: "alert",
      data: {
        productId: plain._id,
        sellerId: plain.sellerId,
        masterProductId: plain.masterProductId,
        changeTypes: types,
        reviewPending: true,
      },
    }));

    if (notifications.length > 0) {
      await createNotificationBatch(notifications);
    }
  } catch (err) {
    console.warn("[sellerProductReview] notification failed:", err.message);
  }
}

/** Compare before/after snapshots, flag product, and notify admins. */
export async function handleSellerListingChangeReview(productBefore, productAfter) {
  if (!shouldTrackSellerReview(productBefore)) return;

  const before = captureSellerListingSnapshot(productBefore);
  const after = captureSellerListingSnapshot(productAfter);
  const types = detectSellerListingChanges(before, after);
  if (!types.length) return;

  const summary = await markSellerListingForAdminReview(productAfter, types, before, after);
  await notifyAdminsSellerListingUpdated(productAfter, types, summary);
}
