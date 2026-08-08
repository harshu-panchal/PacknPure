import Product from "../models/product.js";
import { distanceMeters } from "../utils/geoUtils.js";
import { normalizeVariantMatchKey } from "../utils/productHelpers.js";
import { getSellerAvailableQty } from "./inventoryReadService.js";

export const sellerAvailableForMasterVariant = (sellerProduct, masterVariantId, masterProduct) =>
  getSellerAvailableQty(sellerProduct, masterVariantId, masterProduct);

const normalizeMoney = (value) => Math.max(0, Number(Number(value || 0).toFixed(2)));

const effectiveCatalogPrice = (sellerProduct, masterVariantId = null, baseProduct = null) => {
  let sellerVar = null;
  if (masterVariantId && Array.isArray(baseProduct?.variants)) {
    const masterVar = baseProduct.variants.find(
      (v) => String(v._id || v.id) === String(masterVariantId),
    );
    if (masterVar?.name && Array.isArray(sellerProduct?.variants)) {
      const masterVariantName = normalizeVariantMatchKey(masterVar.name);
      sellerVar = sellerProduct.variants.find(
        (v) => normalizeVariantMatchKey(v.name) === masterVariantName,
      );
    }
  }

  if (sellerVar) {
    const vCost = Number(sellerVar.purchasePrice || 0);
    if (vCost > 0) return vCost;
    const vSale = Number(sellerVar.salePrice || 0);
    const vMrp = Number(sellerVar.price || 0);
    return vSale > 0 && vSale < vMrp ? vSale : vMrp;
  }

  if (sellerProduct?.variants?.length > 0) {
    const v = sellerProduct.variants[0];
    const vCost = Number(v.purchasePrice || 0);
    if (vCost > 0) return vCost;
    const vSale = Number(v.salePrice || 0);
    const vMrp = Number(v.price || 0);
    return vSale > 0 && vSale < vMrp ? vSale : vMrp;
  }

  const cost = Number(sellerProduct?.purchasePrice || 0);
  if (cost > 0) return cost;
  const sale = Number(sellerProduct?.salePrice || 0);
  const base = Number(sellerProduct?.price || 0);
  return sale > 0 && sale < base ? sale : base;
};

export const rankSellerAllocations = async ({
  baseProduct,
  shortageQty,
  variantId = null,
  hubLat = 0,
  hubLng = 0,
  enableMultiSellerAllocation = false,
  excludeSellerIds = [],
}) => {
  if (!baseProduct || shortageQty <= 0) return [];

  // Candidates must be THE SAME product (by link or exact name) — never just
  // "same category". A bare categoryId match here previously let an unrelated
  // in-stock product (e.g. a seller's Beans) get picked as a false "supplier"
  // for a different shortage (e.g. Tomato) just because they share a category.
  const matchOr = [{ _id: baseProduct._id }, { masterProductId: baseProduct._id }];
  if (String(baseProduct.name || "").trim()) {
    const escapedName = baseProduct.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    matchOr.push({ name: new RegExp(`^${escapedName}$`, "i") });
  }

  let candidates = await Product.find({
    sellerId: { $ne: null },
    status: { $nin: ["inactive", "rejected"] },
    $or: matchOr,
  })
    .select("_id sellerId stock name categoryId subcategoryId price salePrice purchasePrice variants gstRate gstEnabled")
    .populate("sellerId", "location rating createdAt")
    .lean();

  if (baseProduct.sellerId) {
    const baseSellerIdStr = typeof baseProduct.sellerId === "object" ? String(baseProduct.sellerId._id || baseProduct.sellerId) : String(baseProduct.sellerId);
    const alreadyFound = candidates.some((c) => {
      const sid = c.sellerId ? (c.sellerId._id ? String(c.sellerId._id) : String(c.sellerId)) : null;
      return sid === baseSellerIdStr;
    });
    if (!alreadyFound) {
      const fullBase = await Product.findById(baseProduct._id)
        .select("_id sellerId stock name categoryId subcategoryId price salePrice purchasePrice variants gstRate gstEnabled")
        .populate("sellerId", "location rating createdAt")
        .lean();
      if (fullBase && fullBase.sellerId) {
        candidates.push(fullBase);
      }
    }
  }

  if (Array.isArray(excludeSellerIds) && excludeSellerIds.length > 0) {
    const excludeSet = new Set(excludeSellerIds.map(String));
    candidates = candidates.filter((c) => {
      const sid = c.sellerId ? (c.sellerId._id ? String(c.sellerId._id) : String(c.sellerId)) : null;
      return !excludeSet.has(sid);
    });
  }

  const inStock = candidates.filter(
    (row) => sellerAvailableForMasterVariant(row, variantId, baseProduct) > 0,
  );
  const eligibleList = inStock.length > 0 ? inStock : candidates;
  if (!eligibleList.length) return [];

  const scored = eligibleList.map((row) => {
    const unitCost = normalizeMoney(effectiveCatalogPrice(row, variantId, baseProduct));
    const seller = row.sellerId || {};
    let distance = Infinity;
    if (seller.location?.coordinates?.length === 2) {
      const [slng, slat] = seller.location.coordinates;
      distance = distanceMeters(hubLat, hubLng, slat, slng);
    }
    return {
      ...row,
      unitCost,
      distance,
      rating: Number(seller.rating || 0),
      createdAt: seller.createdAt ? new Date(seller.createdAt).getTime() : Date.now(),
      sellerIdStr: seller._id ? String(seller._id) : null,
    };
  });

  // Keep exact existing ranking order.
  scored.sort((a, b) => {
    if (a.unitCost !== b.unitCost) return a.unitCost - b.unitCost;
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (a.rating !== b.rating) return b.rating - a.rating;
    return a.createdAt - b.createdAt;
  });

  const allocations = [];
  let remainingShortage = Number(shortageQty || 0);
  let primaryFilled = false;

  for (const vendor of scored) {
    const vendorStock = sellerAvailableForMasterVariant(vendor, variantId, baseProduct);
    let allocatedQty = 0;

    if (enableMultiSellerAllocation) {
      if (remainingShortage > 0) {
        allocatedQty = Math.min(vendorStock, remainingShortage);
        remainingShortage -= allocatedQty;
      }
    } else if (!primaryFilled && remainingShortage > 0) {
      allocatedQty = Math.min(vendorStock, remainingShortage);
      if (allocatedQty > 0) {
        remainingShortage -= allocatedQty;
        // Only lock to a single vendor when the full shortage is covered.
        // Partial fill from vendor A must allow vendor B for the remainder so
        // procurement matches aggregate seller availability shown to customers.
        if (remainingShortage <= 0) {
          primaryFilled = true;
        }
      }
    }

    allocations.push({
      vendorId: vendor.sellerIdStr,
      selectedSellerProductId: vendor._id ? String(vendor._id) : null,
      vendorUnitCost: vendor.unitCost,
      vendorQuotedPrice: vendor.unitCost,
      pricingStrategy: "ranked_cheapest_nearest",
      gstEnabled: Boolean(vendor.gstEnabled),
      gstRate: Number(vendor.gstRate) || 0,
      allocatedQty,
    });
  }

  return allocations;
};
