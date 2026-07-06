import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Product from "./app/models/product.js";
import { sellerProcurementCapacity } from "./app/services/hubOrderOrchestrator.js";
import { sellerAvailableForMasterVariant } from "./app/services/hubOrderOrchestrator.js"; // Wait, sellerAvailableForMasterVariant might not be exported. Let me just check stock directly.

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  
  const masterProduct = await Product.findOne({ name: "basmati rice", ownerType: "admin" }).lean();
  console.log("Master Product:", masterProduct._id);
  
  const matchOr = [{ masterProductId: masterProduct._id }, { name: "basmati rice" }];
  const candidates = await Product.find({
    ownerType: "seller",
    status: "active",
    sellerId: { $ne: null },
    $or: matchOr
  }).select("_id sellerId stock name price salePrice purchasePrice variants").lean();
  
  console.log("Active Candidates found:", candidates.length);
  candidates.forEach(c => {
      console.log(`Seller: ${c.sellerId}`);
      c.variants.forEach(v => {
          console.log(`  Variant ${v.name}: Stock ${v.stock}, Committed ${v.committedStock || 0}`);
      });
  });
  
  process.exit();
}
run();
