import connectDB from './app/dbConfig/dbConfig.js';
import Product from './app/models/product.js';
import HubInventory from './app/models/hubInventory.js';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  await connectDB();
  
  const query = {
      $or: [
        { name: { $regex: 'rice', $options: "i" } }
      ]
  };

  try {
      const products = await Product.find(query)
        .populate("hubStocks", "quantity reserved lowStockThreshold")
        .limit(10)
        .lean();
      
      console.log("Found products:", products.length);
      products.forEach(p => {
          console.log(`Product: ${p.name}, hubStocks:`, p.hubStocks);
      });
  } catch(e) {
      console.error("Error populating:", e.message);
  }

  process.exit(0);
})();
