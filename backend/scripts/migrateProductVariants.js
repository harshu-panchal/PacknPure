import mongoose from "mongoose";
import Product from "../app/models/product.js";

async function migrate() {
  console.log("Starting DB Migration for Product Variants...");
  
  try {
    const products = await Product.find({});
    let migratedCount = 0;
    
    for (const p of products) {
      const rootDoc = p.toObject ? p.toObject() : p;
      const variants = Array.isArray(p.variants) ? p.variants : [];
      
      // If the product has no variants, but has legacy pricing/stock, migrate them
      if (variants.length === 0) {
        const legacyPrice = Number(rootDoc.price) || 0;
        const legacySalePrice = Number(rootDoc.salePrice) || legacyPrice;
        const legacyPurchasePrice = Number(rootDoc.purchasePrice) || 0;
        const legacyStock = Number(rootDoc.stock) || 0;
        const legacyUnit = rootDoc.unit || "Pieces";
        const legacyGstEnabled = rootDoc.gstEnabled || false;
        const legacyGstRate = Number(rootDoc.gstRate) || 0;
        
        p.variants.push({
          name: "Default",
          unit: legacyUnit,
          price: legacyPrice,
          salePrice: legacySalePrice,
          purchasePrice: legacyPurchasePrice,
          stock: legacyStock,
          gstEnabled: legacyGstEnabled,
          gstRate: legacyGstRate
        });
        
        await p.save();
        migratedCount++;
        console.log(`Migrated product ${p._id} (${p.name})`);
      }
    }
    console.log(`Migration Complete. Migrated ${migratedCount} products.`);
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

// Ensure connection is open if running standalone
if (mongoose.connection.readyState !== 1) {
    // You would connect to your DB here if running via command line manually.
    console.log("Please run this script inside the main application context where mongoose is connected.");
} else {
    migrate();
}

export default migrate;
