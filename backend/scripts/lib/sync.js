import mongoose from 'mongoose';
import HubInventory from '../../app/models/hubInventory.js';
import Product from '../../app/models/product.js';

mongoose.connect('mongodb://127.0.0.1:27017/packandpure').then(async () => {
  console.log("Connected");
  const hubs = await HubInventory.find({});
  let fixed = 0;
  for (const h of hubs) {
    const p = await Product.findById(h.productId);
    if (p) {
      const vStock = p.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || p.stock || 0;
      if (h.availableQty !== vStock || p.stock !== vStock) {
        console.log('Mismatch found for', p.name, 'Hub:', h.availableQty, 'Root:', p.stock, 'VariantSum:', vStock);
        p.stock = h.availableQty;
        if (p.variants && p.variants.length > 0) {
          p.variants[0].stock = h.availableQty;
        }
        await p.save();
        console.log('Fixed:', p.name);
        fixed++;
      }
    }
  }
  console.log("Fixed count:", fixed);
  process.exit(0);
});
