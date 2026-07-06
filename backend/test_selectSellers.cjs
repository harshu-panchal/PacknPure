require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../../app/models/product.js").default;

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  
  const masterProduct = await Product.findOne({ name: "basmati rice", ownerType: "admin" }).lean();
  console.log("Master Product:", masterProduct._id);
  
  const sellers = await Product.find({ masterProductId: masterProduct._id }).lean();
  console.log("Total sellers mapping this product:", sellers.length);
  
  const matchOr = [{ masterProductId: masterProduct._id }, { name: "basmati rice" }];
  const candidates = await Product.find({
    ownerType: "seller",
    status: "active",
    sellerId: { $ne: null },
    $or: matchOr
  }).select("_id sellerId stock name price salePrice purchasePrice variants").lean();
  
  console.log("Active Candidates found:", candidates.length);
  console.log(candidates.map(c => ({ 
    id: c._id, 
    sellerId: c.sellerId,
    stock: c.stock, 
    variants: c.variants.map(v => ({ name: v.name, stock: v.stock }))
  })));
  
  process.exit();
}
run();
