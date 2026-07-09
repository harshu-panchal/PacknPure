import mongoose from "mongoose";
import dotenv from "dotenv";
import { selectCheapestSellers } from "../app/services/hubOrderOrchestrator.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const baseProduct = {
    _id: "test-product-1",
    name: "Test Master Product",
    gstRate: 5, // Fallback GST
    variants: [
      { _id: "v1", name: "1 kg", stock: 100 }
    ]
  };

  const inStock = [
    {
      _id: "seller-product-1",
      sellerId: { _id: "s1", rating: 4, createdAt: new Date() },
      purchasePrice: 40,
      gstEnabled: false,
      gstRate: 0,
      stock: 50,
      variants: [
        { name: "1 kg", purchasePrice: 40, gstEnabled: false, gstRate: 0, stock: 50 }
      ]
    },
    {
      _id: "seller-product-2",
      sellerId: { _id: "s2", rating: 4.5, createdAt: new Date() },
      purchasePrice: 39,
      gstEnabled: true,
      gstRate: 5,
      stock: 50,
      variants: [
        { name: "1 kg", purchasePrice: 39, gstEnabled: true, gstRate: 5, stock: 50 }
      ]
    }
  ];

  const allocations = selectCheapestSellers(inStock, 60, "v1", baseProduct);
  
  console.log("Allocations:");
  console.dir(allocations, { depth: null });

  process.exit(0);
}

run().catch(console.error);
