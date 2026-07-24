import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

import "./app/models/purchaseRequest.js";

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const PurchaseRequest = mongoose.model("PurchaseRequest");
    
    // Find some PRs
    const prs = await PurchaseRequest.find({ expiresAt: { $exists: true } }).limit(5).lean();
    console.log("PR Expiries in DB:");
    for (const pr of prs) {
      console.log(`- RequestId: ${pr.requestId}`);
      console.log(`  expiresAt (Date object):`, pr.expiresAt);
      console.log(`  expiresAt (toISOString):`, pr.expiresAt ? pr.expiresAt.toISOString() : "null");
      console.log(`  expiresAt (Type):`, typeof pr.expiresAt);
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
