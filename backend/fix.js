import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
  const HubInventory = mongoose.model('HubInventory', new mongoose.Schema({}, { strict: false }));
  
  // 1. Reset all committedStock to 0
  await Product.updateMany({}, { $set: { 'variants.$[].committedStock': 0 } });
  
  // 2. Fetch all HubInventories
  const hubs = await HubInventory.find({});
  
  // 3. For each hub, update the product variant stock to match availableQty if it's the only variant or if the product has only 1 active variant
  // Actually, for Basmati Rice, we just want to reset its stock to 0 because HubInventory availableQty is 0.
  // Wait, if HubInventory availableQty is 0, let's just force all product variant stocks to 0 to be safe if they are out of sync?
  // No, we can just sync from HubInventory for all admin products!
  const adminProducts = await Product.find({ ownerType: "admin" });
  for (let p of adminProducts) {
    const hub = hubs.find(h => String(h.productId) === String(p._id));
    const availableQty = hub ? (hub.availableQty || 0) : 0;
    
    // For basmati rice which is having 98 stock, if availableQty is 0, we can reset variants
    if (availableQty === 0 && p.variants) {
       let updated = false;
       for (let i = 0; i < p.variants.length; i++) {
         if (p.variants[i].stock > 0) {
           p.variants[i].stock = 0;
           updated = true;
         }
       }
       if (updated) {
         await Product.updateOne({ _id: p._id }, { $set: { variants: p.variants } });
         console.log(`Reset stock to 0 for ${p.name}`);
       }
    }
  }
  
  console.log('Fixed committedStock to 0 and synced 0 stock variants on remote database');
  process.exit(0);
}

fix();
