import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./app/models/product.js";
import { rankSellerAllocations } from "./app/services/allocationEngine.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(mongoUri);
  console.log("Connected!");

  // Find admin carrot product
  const baseProduct = await Product.findOne({ name: /carrot/i, ownerType: "admin" }).lean();
  console.log("baseProduct ID:", baseProduct._id);
  const variantId = baseProduct.variants[0]._id;
  console.log("variantId:", variantId);

  const allocations = await rankSellerAllocations({
    baseProduct,
    shortageQty: 1,
    variantId,
    hubLat: 0,
    hubLng: 0,
    enableMultiSellerAllocation: false,
  });

  console.log("\n=== ALLOCATIONS ===");
  console.log(allocations);

  await mongoose.disconnect();
}

run().catch(console.error);
