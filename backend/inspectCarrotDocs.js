import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI;

const productSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model("Product", productSchema, "products");

async function run() {
  await mongoose.connect(mongoUri);
  const products = await Product.find({ name: /carrot/i }).lean();
  console.log(JSON.stringify(products, null, 2));
  await mongoose.disconnect();
}

run().catch(console.error);
