import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Product from '../app/models/product.js';
import PurchaseRequest from '../app/models/purchaseRequest.js';

async function fixInventory() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const sellerProducts = await Product.find({ ownerType: 'seller' });
    console.log(`Found ${sellerProducts.length} seller products.`);

    let fixedCount = 0;

    for (const product of sellerProducts) {
      let productNeedsUpdate = false;
      const updates = {};
      const arrayFilters = [];
      
      // Calculate active PR commitments for the parent product (if no variants)
      const parentPrs = await PurchaseRequest.aggregate([
        { $match: { status: { $in: ["created", "seller_confirmed", "pickup_assigned"] } } },
        { $unwind: "$items" },
        { $match: { "items.selectedSellerProductId": product._id, "items.variantId": null } },
        { $group: { _id: null, totalCommitted: { $sum: "$items.shortageQty" } } }
      ]);
      const trueParentCommitted = parentPrs.length > 0 ? parentPrs[0].totalCommitted : 0;
      
      const parentDiff = trueParentCommitted - (product.committedStock || 0);
      if (parentDiff !== 0) {
        console.log(`Product ${product.name} (ID: ${product._id}) - Parent mismatch: DB committed=${product.committedStock}, True=${trueParentCommitted}. Adjusting stock by ${-parentDiff}`);
        updates["committedStock"] = trueParentCommitted;
        updates["stock"] = Math.max(0, (product.stock || 0) - parentDiff);
        productNeedsUpdate = true;
      }

      // Check variants
      if (product.variants && product.variants.length > 0) {
        for (let i = 0; i < product.variants.length; i++) {
          const variant = product.variants[i];
          const variantPrs = await PurchaseRequest.aggregate([
            { $match: { status: { $in: ["created", "seller_confirmed", "pickup_assigned"] } } },
            { $unwind: "$items" },
            { $match: { "items.selectedSellerProductId": product._id, "items.variantId": variant._id } },
            { $group: { _id: null, totalCommitted: { $sum: "$items.shortageQty" } } }
          ]);
          
          const trueVariantCommitted = variantPrs.length > 0 ? variantPrs[0].totalCommitted : 0;
          const variantDiff = trueVariantCommitted - (variant.committedStock || 0);
          
          if (variantDiff !== 0) {
            console.log(`Product ${product.name} (ID: ${product._id}) - Variant ${variant.name} mismatch: DB committed=${variant.committedStock}, True=${trueVariantCommitted}. Adjusting stock by ${-variantDiff}`);
            updates[`variants.$[v${i}].committedStock`] = trueVariantCommitted;
            updates[`variants.$[v${i}].stock`] = Math.max(0, (variant.stock || 0) - variantDiff);
            arrayFilters.push({ [`v${i}._id`]: variant._id });
            productNeedsUpdate = true;
          }
        }
      }

      if (productNeedsUpdate) {
        const updateParams = { $set: updates };
        const options = arrayFilters.length > 0 ? { arrayFilters } : {};
        await Product.updateOne({ _id: product._id }, updateParams, options);
        fixedCount++;
        console.log(`Fixed product ${product._id}`);
      }
    }

    console.log(`\nInventory fix completed. Fixed ${fixedCount} products.`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

fixInventory();
