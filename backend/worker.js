import dotenv from "dotenv";
import connectDB from "./app/dbConfig/dbConfig.js";
import { registerOrderQueueProcessors } from "./app/queues/orderQueueProcessors.js";
import { registerNotificationQueueProcessors } from "./app/queues/notificationQueueProcessors.js";

dotenv.config();

const startWorker = async () => {
  try {
    await connectDB();
    registerOrderQueueProcessors();
    registerNotificationQueueProcessors();
    console.log("[Worker] Queue processors started");
  } catch (error) {
    console.error("[Worker] Failed to start", error);
    process.exit(1);
  }
};

await startWorker();

const shutdown = async () => {
  try {
    process.exit(0);
  } catch {
    process.exit(1);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

