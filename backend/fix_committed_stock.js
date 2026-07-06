import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Product from "./app/models/product.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const sellerProductId = "6a4b866fdf04cc4fb073ff5f"; // Mateshwari medical
  const sellerProduct = await Product.findById(sellerProductId);
  
  if (sellerProduct) {
    let changed = false;
    // Fix committedStock at product level
    if (sellerProduct.committedStock > 0) {
      sellerProduct.committedStock = 0;
      changed = true;
    }

    // Fix committedStock at variant level
    sellerProduct.variants.forEach(v => {
      if (v.committedStock > 0) {
        v.committedStock = 0;
        changed = true;
      }
    });

    if (changed) {
      await sellerProduct.save();
      console.log("Successfully fixed committedStock for seller product", sellerProductId);
    } else {
      console.log("No changes needed for seller product", sellerProductId);
    }
  } else {
    console.log("Seller product not found");
  }

  mongoose.disconnect();
}

run().catch(console.error);
