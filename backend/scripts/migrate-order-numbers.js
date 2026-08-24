/**
 * One-time migration: backfill displayOrderNumber / orderSequenceNumber /
 * orderNumberSource for existing orders that predate the sequential
 * order-numbering feature.
 *
 * Orders are processed oldest-first so sequence numbers reflect creation
 * order, then draw from the SAME global counter live order creation uses —
 * so the first live order created after this script finishes continues
 * seamlessly from n+1.
 *
 * Run: node scripts/migrate-order-numbers.js
 */
import dotenv from "dotenv";
import connectDB from "../app/dbConfig/dbConfig.js";
import Order from "../app/models/order.js";
import { generateOrderNumber } from "../app/services/orderNumberService.js";

dotenv.config();

// Mirrors the live-creation mapping in coreOrderService.js / posCheckoutController.js:
// POS orders with a sellerId are "seller" orders, other POS orders are "pos"
// orders, and everything else (ONLINE/ADMIN/PHONE/MARKETPLACE/API) is a "hub" order.
const resolveNumberSource = (order) => {
  if (order.orderSource === "POS") {
    return order.posDetails?.sellerId ? "seller" : "pos";
  }
  return "hub";
};

async function run() {
  await connectDB();

  const cursor = Order.find({
    $or: [{ displayOrderNumber: { $exists: false } }, { displayOrderNumber: null }],
  })
    .sort({ createdAt: 1 })
    .cursor();

  let n = 0;
  for await (const doc of cursor) {
    const source = resolveNumberSource(doc);
    const { displayOrderNumber, sequenceNumber, orderNumberSource } =
      await generateOrderNumber(source);

    doc.displayOrderNumber = displayOrderNumber;
    doc.orderSequenceNumber = sequenceNumber;
    doc.orderNumberSource = orderNumberSource;
    await doc.save();
    n += 1;
  }

  console.log(`[migrate-order-numbers] Backfilled ${n} orders`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
