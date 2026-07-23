import Product from "../../models/product.js";
import {
  deductHubInventory,
  restoreHubAvailableInventory,
  restoreSellerInventory,
  deductSellerInventory,
} from "../inventory/inventoryEngine.js";
import {
  getSellerProductStockView,
  buildCanonicalStockContext,
} from "../inventoryReadService.js";
import { normalizeVariantMatchKey } from "../../utils/productHelpers.js";
import {
  findVariantByBarcode,
  getVariantBarcodeValue,
  looksLikePacknPureBarcode,
  normalizeBarcodeScan,
} from "./barcodeLookup.js";

const toQty = (v) => Math.max(0, Number(v || 0));

function createInactiveProductError(productName) {
  const err = new Error(
    productName
      ? `"${productName}" is inactive and cannot be sold`
      : "This product is inactive and cannot be sold",
  );
  err.code = "POS_PRODUCT_INACTIVE";
  return err;
}

// Base Interface Pattern
class InventoryProvider {
    async searchProducts(search, limit) { throw new Error("Not implemented"); }
    async deductStock(productId, variantId, quantity, session) { throw new Error("Not implemented"); }
    async restoreStock(productId, variantId, quantity, session) { throw new Error("Not implemented"); }
}

export class AdminInventoryProvider extends InventoryProvider {
    async searchProducts(search, limit) {
        const term = normalizeBarcodeScan(search);
        if (!term) return [];

        // Fast path: exact Phase-1 barcode → single variant + latest price/stock
        if (looksLikePacknPureBarcode(term)) {
            const product = await Product.findOne({
                ownerType: "admin",
                $or: [
                    { "variants.barcodeValue": term },
                    { "variants.barcodeId": term },
                ],
            }).lean();

            if (!product) return [];
            if (product.status !== "active") {
                throw createInactiveProductError(product.name);
            }

            const variant = findVariantByBarcode(product, term, { ownerType: "admin" });
            if (!variant) return [];

            const canonicalCtx = await buildCanonicalStockContext([product._id]);
            const view = canonicalCtx.productViews.get(String(product._id));
            const vv = view?.variantByKey?.get(normalizeVariantMatchKey(variant.name));

            return [{
                _id: product._id,
                name: product.name,
                image: product.images?.[0]?.url || product.mainImage || "",
                gstEnabled: variant.gstEnabled ?? product.gstEnabled,
                gstRate: variant.gstRate ?? product.gstRate,
                variantId: variant._id,
                variantName: variant.name,
                sku: variant.sku,
                barcode: getVariantBarcodeValue(variant, "admin"),
                price: variant.salePrice || variant.price || 0,
                stock: vv?.stock ?? toQty(variant.stock),
                availableQty: vv?.totalAvailableQty ?? 0,
                availableQtyHub: vv?.availableQtyHub ?? 0,
                availableQtySeller: vv?.availableQtySeller ?? 0,
                totalAvailableQty: vv?.totalAvailableQty ?? 0,
                totalFulfillmentQty: vv?.totalFulfillmentQty ?? 0,
                hubAvailableQty: vv?.availableQtyHub ?? 0,
                sellerSupplyBreakdown: vv?.sellerSupplyBreakdown ?? [],
            }];
        }

        const query = {
            $or: [
                { name: { $regex: term, $options: "i" } },
                { sku: { $regex: term, $options: "i" } },
                { "variants.sku": { $regex: term, $options: "i" } },
                { "variants.barcodeValue": term },
                { "variants.barcodeId": term },
            ],
            ownerType: "admin",
            status: "active"
        };

        const products = await Product.find(query).limit(parseInt(limit)).lean();
        const canonicalCtx = await buildCanonicalStockContext(products.map((p) => p._id));
        const formattedResults = products.map((p) => {
            const view = canonicalCtx.productViews.get(String(p._id));
            const baseResult = {
              _id: p._id,
              name: p.name,
              image: p.images?.[0]?.url || p.mainImage || "",
              gstEnabled: p.gstEnabled,
              gstRate: p.gstRate,
              stock: view?.stock ?? 0,
              availableQty: view?.totalAvailableQty ?? 0,
              availableQtyHub: view?.availableQtyHub ?? 0,
              availableQtySeller: view?.availableQtySeller ?? 0,
              totalAvailableQty: view?.totalAvailableQty ?? 0,
              totalFulfillmentQty: view?.totalFulfillmentQty ?? 0,
              hubAvailableQty: view?.availableQtyHub ?? 0,
            };

            if (p.variants && p.variants.length > 0) {
              return p.variants.map((v) => {
                const vv = view?.variantByKey?.get(normalizeVariantMatchKey(v.name));
                return {
                  ...baseResult,
                  variantId: v._id,
                  variantName: v.name,
                  sku: v.sku,
                  barcode: getVariantBarcodeValue(v, "admin"),
                  price: v.salePrice || v.price || 0,
                  stock: vv?.stock ?? toQty(v.stock),
                  availableQty: vv?.totalAvailableQty ?? 0,
                  availableQtyHub: vv?.availableQtyHub ?? 0,
                  availableQtySeller: vv?.availableQtySeller ?? 0,
                  totalAvailableQty: vv?.totalAvailableQty ?? 0,
                  totalFulfillmentQty: vv?.totalFulfillmentQty ?? 0,
                  hubAvailableQty: vv?.availableQtyHub ?? 0,
                  sellerSupplyBreakdown: vv?.sellerSupplyBreakdown ?? [],
                };
              });
            }
            return [{
              ...baseResult,
              variantId: null,
              variantName: null,
              sku: p.sku,
              barcode: p.sku,
              price: p.salePrice || p.basePrice || p.price || 0,
            }];
          });
        const flatResults = formattedResults.flat();

        const exactMatch = flatResults.find(r => r.barcode === term);
        return exactMatch ? [exactMatch] : flatResults.slice(0, parseInt(limit));
    }

    async deductStock(productId, variantId, quantity, session) {
        const result = await deductHubInventory({ productId, variantId, quantity, session, reason: "pos_sale" });
        return result.applied ? result.hubInventory : null;
    }

    async restoreStock(productId, variantId, quantity, session) {
        const result = await restoreHubAvailableInventory({ productId, variantId, quantity, session, reason: "pos_return" });
        return result.hubInventory;
    }
}

export class SellerInventoryProvider extends InventoryProvider {
    constructor(sellerId) {
        super();
        this.sellerId = sellerId;
    }

    async searchProducts(search, limit) {
        const term = normalizeBarcodeScan(search);
        if (!term) return [];

        // Fast path: exact Phase-1 seller barcode → single variant + latest supply price/stock
        if (looksLikePacknPureBarcode(term)) {
            const product = await Product.findOne({
                ownerType: "seller",
                sellerId: this.sellerId,
                $or: [
                    { "variants.sellerBarcodeValue": term },
                    { "variants.sellerBarcodeId": term },
                ],
            }).lean();

            if (!product) return [];
            if (product.status !== "active") {
                throw createInactiveProductError(product.name);
            }

            const variant = findVariantByBarcode(product, term, { ownerType: "seller" });
            if (!variant) return [];

            const stockView = getSellerProductStockView(product);
            const variantIndex = product.variants.findIndex(
                (v) => String(v._id) === String(variant._id),
            );
            const vv = variantIndex >= 0 ? stockView.variants[variantIndex] : null;

            return [{
                _id: product._id,
                name: product.name,
                image: product.images?.[0]?.url || product.mainImage || "",
                gstEnabled: variant.gstEnabled ?? product.gstEnabled,
                gstRate: variant.gstRate ?? product.gstRate,
                variantId: variant._id,
                variantName: variant.name,
                sku: variant.sku,
                barcode: getVariantBarcodeValue(variant, "seller"),
                // Existing seller POS price resolution (latest from DB — never from barcode).
                price: variant.salePrice || variant.price || variant.purchasePrice || 0,
                stock: vv?.grossStock ?? toQty(variant.stock),
                availableQty: vv?.availableQty ?? 0,
                availableQtySeller: vv?.availableQty ?? 0,
                totalAvailableQty: vv?.availableQty ?? 0,
                totalFulfillmentQty: vv?.availableQty ?? 0,
            }];
        }

        const query = {
            $or: [
                { name: { $regex: term, $options: "i" } },
                { sku: { $regex: term, $options: "i" } },
                { "variants.sku": { $regex: term, $options: "i" } },
                { "variants.sellerBarcodeValue": term },
                { "variants.sellerBarcodeId": term },
            ],
            ownerType: "seller",
            sellerId: this.sellerId,
            status: "active"
        };

        const products = await Product.find(query).limit(parseInt(limit)).lean();

        const formattedResults = products.map((p) => {
            const stockView = getSellerProductStockView(p);
            const baseResult = {
                _id: p._id,
                name: p.name,
                image: p.images?.[0]?.url || p.mainImage || "",
                gstEnabled: p.gstEnabled,
                gstRate: p.gstRate,
                stock: stockView.grossStock,
                availableQty: stockView.availableQty,
                availableQtySeller: stockView.availableQty,
                totalAvailableQty: stockView.availableQty,
                totalFulfillmentQty: stockView.availableQty,
            };

            if (p.variants && p.variants.length > 0) {
                return stockView.variants.map((v, idx) => ({
                    ...baseResult,
                    variantId: p.variants[idx]?._id,
                    variantName: v.name,
                    sku: p.variants[idx]?.sku,
                    barcode: getVariantBarcodeValue(p.variants[idx], "seller"),
                    price: p.variants[idx]?.salePrice || p.variants[idx]?.price || p.variants[idx]?.purchasePrice || 0,
                    stock: v.grossStock,
                    availableQty: v.availableQty,
                    availableQtySeller: v.availableQty,
                    totalAvailableQty: v.availableQty,
                    totalFulfillmentQty: v.availableQty,
                }));
            }
            return [{
                ...baseResult,
                variantId: null,
                variantName: null,
                sku: p.sku,
                barcode: p.sku,
                price: p.salePrice || p.basePrice || p.price || p.purchasePrice || 0,
            }];
        }).flat();

        const exactMatch = formattedResults.find(r => r.barcode === term);
        return exactMatch ? [exactMatch] : formattedResults.slice(0, parseInt(limit));
    }

    async deductStock(productId, variantId, quantity, session) {
        const result = await deductSellerInventory({
            productId,
            variantId,
            quantity,
            session,
            sellerId: this.sellerId,
            reason: "pos_sale",
        });
        return result.success;
    }

    async restoreStock(productId, variantId, quantity, session) {
        return await restoreSellerInventory({
            productId,
            variantId,
            quantity,
            session,
            sellerId: this.sellerId,
            reason: "pos_return",
        });
    }
}
