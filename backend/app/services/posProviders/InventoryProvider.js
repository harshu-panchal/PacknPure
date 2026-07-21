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

const toQty = (v) => Math.max(0, Number(v || 0));

// Base Interface Pattern
class InventoryProvider {
    async searchProducts(search, limit) { throw new Error("Not implemented"); }
    async deductStock(productId, variantId, quantity, session) { throw new Error("Not implemented"); }
    async restoreStock(productId, variantId, quantity, session) { throw new Error("Not implemented"); }
}

export class AdminInventoryProvider extends InventoryProvider {
    async searchProducts(search, limit) {
        const query = {
            $or: [
                { name: { $regex: search, $options: "i" } },
                { sku: { $regex: search, $options: "i" } },
                { "variants.sku": { $regex: search, $options: "i" } },
                { "variants.barcode": search }
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
                  barcode: v.barcode,
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

        const exactMatch = flatResults.find(r => r.barcode === search);
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
        const query = {
            $or: [
                { name: { $regex: search, $options: "i" } },
                { sku: { $regex: search, $options: "i" } },
                { "variants.sku": { $regex: search, $options: "i" } },
                { "variants.barcode": search }
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
                    barcode: p.variants[idx]?.barcode,
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

        const exactMatch = formattedResults.find(r => r.barcode === search);
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
