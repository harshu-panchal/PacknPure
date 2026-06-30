import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "./backend/.env") });

async function fixStock() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");

  const Product = (await import("./backend/app/models/product.js")).default;
  const HubInventory = (await import("./backend/app/models/hubInventory.js")).default;

  const p = await Product.findById("6a3bcfba6c238e9831c42bc2");
  if (!p) {
    console.log("Product not found");
    return;
  }

  const hubRow = await HubInventory.findOne({ productId: p._id });
  
  if (hubRow) {
     p.stock = hubRow.availableQty;
     if (p.variants && p.variants.length > 0) {
       let total = hubRow.availableQty;
       p.variants.forEach(v => {
         const take = Math.min(v.stock, total);
         v.stock = take;
         total -= take;
       });
     }
     await p.save();
     console.log("Fixed product stock to match HubInventory.");
  }

  process.exit(0);
}

fixStock();
