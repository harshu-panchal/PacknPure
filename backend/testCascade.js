import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./app/models/product.js";
import Order from "./app/models/order.js";
import ProcurementSession from "./app/models/procurementSession.js";
import PurchaseRequest from "./app/models/purchaseRequest.js";
import { createAutoPurchaseRequests } from "./app/services/hubOrderOrchestrator.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB!");

  const baseProduct = await Product.findOne({ name: /carrot/i, ownerType: "admin" }).lean();
  console.log("Carrot Master Product ID:", baseProduct._id);

  // 1. Create a dummy order
  const orderId = `TEST-ORD-${Date.now()}`;
  const dummyOrder = new Order({
    orderId,
    customer: new mongoose.Types.ObjectId(), // dummy customer ID
    seller: null,
    items: [
      {
        product: baseProduct._id,
        name: baseProduct.name,
        quantity: 1,
        price: 50,
        purchasePrice: 25,
        hubReservedQty: 0,
        vendorProcuredQty: 1,
      }
    ],
    address: {
      type: "Home",
      name: "Test User",
      address: "123 Test Street",
      city: "Indore",
      phone: "9999999999",
      location: { lat: 22.7505, lng: 75.8713 }
    },
    payment: { method: "cash", status: "pending" },
    pricing: { subtotal: 50, deliveryFee: 0, platformFee: 0, gst: 0, total: 50 },
    status: "pending",
    workflowVersion: 2,
    hubFlowEnabled: true,
    procurementRequired: true,
  });

  await dummyOrder.save();
  console.log("Created test order with ID:", dummyOrder._id);

  // 2. Simulate Mayur has already been attempted.
  // Mayur sellerId: 6a72de087e71d6116a7ae1be
  const mayurId = "6a72de087e71d6116a7ae1be";
  const itemKey = `${String(baseProduct._id)}::root`;

  const session = await ProcurementSession.create({
    orderId: dummyOrder._id,
    hubId: "MAIN_HUB",
    status: "open",
    items: [
      {
        itemKey,
        productId: baseProduct._id,
        variantId: null,
        requiredQty: 1,
        remainingQty: 1,
        allocatedQty: 0,
        acceptedQty: 0,
        rejectedQty: 0,
        completedQty: 0,
        failedQty: 0,
        retryCount: 0,
      }
    ],
    allocations: [
      {
        allocationId: "ALC-MOCK-MAYUR",
        itemKey,
        productId: baseProduct._id,
        variantId: null,
        quantity: 1,
        vendorId: mayurId,
        status: "timed_out", // Mayur timed out
        reservationState: "RELEASED",
      }
    ],
    metadata: { orderCode: orderId },
  });

  dummyOrder.procurementSessionId = session._id;
  await dummyOrder.save();
  console.log("Created mock procurement session with Mayur as timed_out allocation.");

  // 3. Call createAutoPurchaseRequests to trigger fallback / retry
  console.log("\n--- Triggering createAutoPurchaseRequests (Retry) ---");
  const shortages = [
    {
      productId: String(baseProduct._id),
      variantId: null,
      requiredQty: 1,
      availableQtyAtHub: 0,
      shortageQty: 1,
      vendorId: null,
      baseProduct,
    }
  ];

  const newPrs = await createAutoPurchaseRequests({
    order: dummyOrder,
    shortages,
    hubId: "MAIN_HUB",
    allowUnassigned: false,
  });

  console.log("\n=== RESULTING NEW PURCHASE REQUESTS ===");
  console.log(JSON.stringify(newPrs, null, 2));

  // Cleanup
  await Order.deleteOne({ _id: dummyOrder._id });
  await ProcurementSession.deleteOne({ _id: session._id });
  if (newPrs && newPrs.length > 0) {
    await PurchaseRequest.deleteOne({ _id: newPrs[0]._id });
  }
  console.log("\nCleaned up test data.");

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Test failed:", err);
  await mongoose.disconnect();
});
