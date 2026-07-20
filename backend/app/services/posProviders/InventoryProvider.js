import Product from "../../models/product.js";
import HubInventory from "../../models/hubInventory.js";
import {
  deductHubInventory,
  restoreHubAvailableInventory,
  restoreSellerInventory,
  deductSellerInventory,
} from "../inventory/inventoryEngine.js";

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
        const productIds = products.map(p => p._id);
        const hubStocks = await HubInventory.find({ productId: { $in: productIds } }).lean();

        // Admin sees hub stock
        const formattedResults = products.map(p => {
            const hubStock = hubStocks.find(h => String(h.productId) === String(p._id));
            const baseResult = {
                _id: p._id,
                name: p.name,
                image: p.images?.[0]?.url || p.mainImage || "",
                gstEnabled: p.gstEnabled,
                gstRate: p.gstRate,
                availableQty: hubStock ? Math.max(0, hubStock.availableQty || hubStock.quantity - (hubStock.reservedQty || hubStock.reserved || 0)) : 0,
            };

            if (p.variants && p.variants.length > 0) {
                return p.variants.map(v => ({
                    ...baseResult,
                    variantId: v._id,
                    variantName: v.name,
                    sku: v.sku,
                    barcode: v.barcode,
                    price: v.salePrice || v.price || 0,
                    availableQty: Math.max(0, (v.stock || 0) - (v.committedStock || 0)) // Variant hub stock approximation
                }));
            }
            return [{
                ...baseResult,
                variantId: null,
                variantName: null,
                sku: p.sku,
                barcode: p.sku,
                price: p.salePrice || p.basePrice || p.price || 0
            }];
        }).flat();

        const exactMatch = formattedResults.find(r => r.barcode === search);
        return exactMatch ? [exactMatch] : formattedResults.slice(0, parseInt(limit));
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

        // Seller only sees their own stock
        const formattedResults = products.map(p => {
            const baseResult = {
                _id: p._id,
                name: p.name,
                image: p.images?.[0]?.url || p.mainImage || "",
                gstEnabled: p.gstEnabled,
                gstRate: p.gstRate,
                availableQty: Math.max(0, p.stock || 0) // Natively from product
            };

            if (p.variants && p.variants.length > 0) {
                return p.variants.map(v => ({
                    ...baseResult,
                    variantId: v._id,
                    variantName: v.name,
                    sku: v.sku,
                    barcode: v.barcode,
                    price: v.salePrice || v.price || v.purchasePrice || 0,
                    availableQty: Math.max(0, (v.stock || 0) - (v.committedStock || 0))
                }));
            }
            return [{
                ...baseResult,
                variantId: null,
                variantName: null,
                sku: p.sku,
                barcode: p.sku,
                price: p.salePrice || p.basePrice || p.price || p.purchasePrice || 0
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
