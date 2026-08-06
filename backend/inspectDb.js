import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI;
console.log("Connecting to:", mongoUri);

const sellerSchema = new mongoose.Schema({}, { strict: false });
const Seller = mongoose.model("Seller", sellerSchema, "sellers");

const productSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model("Product", productSchema, "products");

async function run() {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB!");

  // Find all sellers
  const sellers = await Seller.find({}).lean();
  console.log("\n=== SELLERS ===");
  sellers.forEach(s => {
    console.log(`Seller ID: ${s._id}, Name: ${s.businessName || s.name}, Phone: ${s.phone}, Rating: ${s.rating}, coordinates:`, s.location?.coordinates);
  });

  // Find carrot products
  const products = await Product.find({ name: /carrot/i }).lean();
  console.log("\n=== CARROT PRODUCTS ===");
  products.forEach(p => {
    console.log(`Product ID: ${p._id}, Name: ${p.name}, ownerType: ${p.ownerType}, sellerId: ${p.sellerId}, stock: ${p.stock}, price: ${p.price}, salePrice: ${p.salePrice}, purchasePrice: ${p.purchasePrice}`);
    if (p.variants && p.variants.length > 0) {
      console.log("  Variants:");
      p.variants.forEach(v => {
        console.log(`    Variant ID: ${v._id || v.id}, Name: ${v.name}, stock: ${v.stock}, price: ${v.price}, salePrice: ${v.salePrice}, purchasePrice: ${v.purchasePrice}`);
      });
    }
  });

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
}

run().catch(console.error);
