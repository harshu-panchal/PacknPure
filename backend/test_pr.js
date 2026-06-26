import mongoose from 'mongoose';
const run = async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/packandpure');
  const Order = (await import('file:///d:/packandpure/backend/app/models/order.js')).default;
  const PR = (await import('file:///d:/packandpure/backend/app/models/purchaseRequest.js')).default;
  const prs = await PR.find({ requestId: 'PR-1781608485373-507' }).populate('orderId', 'orderId status workflowStatus').lean();
  console.log(JSON.stringify(prs, null, 2));
  process.exit(0);
};
run();
