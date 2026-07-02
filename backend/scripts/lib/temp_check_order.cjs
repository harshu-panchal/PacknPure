const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/packandpure').then(async () => {
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
  const order = await Order.findOne({ deliveryBoy: { $ne: null } }).sort({ createdAt: -1 }).lean();
  console.log(JSON.stringify(order, null, 2));
  process.exit(0);
});
