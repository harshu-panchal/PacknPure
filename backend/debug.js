import connectDB from './app/dbConfig/dbConfig.js';
import Product from './app/models/product.js';
import HubInventory from './app/models/hubInventory.js';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  await connectDB();
  
  const queryWithIsDeleted = {
      $or: [
        { name: { $regex: 'rice', $options: "i" } },
      ],
      isDeleted: false
  };

  const p1 = await Product.find(queryWithIsDeleted).lean();
  console.log("With isDeleted:", p1.length);

  const queryWithoutIsDeleted = {
      $or: [
        { name: { $regex: 'rice', $options: "i" } },
      ]
  };

  const p2 = await Product.find(queryWithoutIsDeleted).lean();
  console.log("Without isDeleted:", p2.length);

  const p3 = await Product.find({ ...queryWithoutIsDeleted, ownerType: 'admin' }).lean();
  console.log("Without isDeleted (admin only):", p3.length);

  const adminIds = p3.map(p => p._id);
  const hubStock = await HubInventory.find({ productId: { $in: adminIds } }).lean();
  console.log("Hub Inventory matched:", hubStock.length);

  process.exit(0);
})();
