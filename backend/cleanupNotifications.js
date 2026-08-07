import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI;
console.log("Connecting to:", mongoUri);

async function run() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB!");

    const db = mongoose.connection.db;

    console.log("\nDropping 'notifications' collection...");
    try {
      await db.collection("notifications").drop();
      console.log("Successfully dropped 'notifications'.");
    } catch (e) {
      if (e.codeName === "NamespaceNotFound") {
        console.log("'notifications' collection already dropped or doesn't exist.");
      } else {
        console.error("Error dropping 'notifications':", e.message);
      }
    }

    console.log("Dropping 'notificationoutboxes' collection...");
    try {
      await db.collection("notificationoutboxes").drop();
      console.log("Successfully dropped 'notificationoutboxes'.");
    } catch (e) {
      if (e.codeName === "NamespaceNotFound") {
        console.log("'notificationoutboxes' collection already dropped or doesn't exist.");
      } else {
        console.error("Error dropping 'notificationoutboxes':", e.message);
      }
    }

    console.log("\nReclaiming storage space complete!");
  } catch (error) {
    console.error("Error cleaning up collections:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

run();
