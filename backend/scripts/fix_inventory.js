import mongoose from "mongoose";
import dotenv from "dotenv";
import HubInventory from "../app/models/hubInventory.js";
import Product from "../app/models/product.js";

dotenv.config();

async function fixInventory() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  // Fix HubInventory
  const hubItems = await HubInventory.find({});
  for (const item of hubItems) {
    if (item.reservedQty < 0) {
      console.log(`Fixing negative reservedQty for Product: ${item.productId}`);
      item.reservedQty = 0;
      await item.save();
    }
  }

  // Fix Seller CommittedStock
  const products = await Product.find({});
  for (const p of products) {
    let changed = false;
    if (p.committedStock < 0) {
      p.committedStock = 0;
      changed = true;
    }
    
    if (Array.isArray(p.variants)) {
      for (const v of p.variants) {
        if (v.committedStock < 0) {
          v.committedStock = 0;
          changed = true;
        }
      }
    }
    
    if (changed) {
      console.log(`Fixing negative committedStock for Product: ${p._id}`);
      await p.save();
    }
  }

  console.log("Inventory fixed successfully.");
  process.exit(0);
}

fixInventory().catch(console.error);
