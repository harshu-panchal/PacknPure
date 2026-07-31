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
}) => {
  if (!baseProduct || shortageQty <= 0) return [];

  const matchOr = [{ masterProductId: baseProduct._id }];
  if (String(baseProduct.name || "").trim()) {
    matchOr.push({ name: String(baseProduct.name).trim() });
  }
  if (baseProduct.categoryId && baseProduct.subcategoryId) {
    matchOr.push({ categoryId: baseProduct.categoryId, subcategoryId: baseProduct.subcategoryId });
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
