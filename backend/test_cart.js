import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Cart from "./app/models/cart.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  
  const carts = await Cart.find();
  for (const c of carts) {
      let changed = false;
      const uniqueKeys = new Set();
      const newItems = [];
      
      for (const item of c.items) {
          const key = `${String(item.productId)}_${String(item.variantId || 'null')}`;
          if (!uniqueKeys.has(key)) {
              uniqueKeys.add(key);
              newItems.push(item);
          } else {
              changed = true;
          }
      }
      
      if (changed) {
          c.items = newItems;
          await c.save();
          console.log(`Cleaned duplicates from cart for customer ${c.customerId}`);
      }
  }
  
  process.exit();
}
run();
