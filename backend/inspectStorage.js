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
    
    // Get list of all collections
    const collections = await db.listCollections().toArray();
    console.log(`\nFound ${collections.length} collections. Analyzing storage space...`);
    
    const statsList = [];
    for (const col of collections) {
      const stats = await db.command({ collStats: col.name });
      statsList.push({
        Collection: col.name,
        Documents: stats.count,
        "Data Size (MB)": (stats.size / (1024 * 1024)).toFixed(2),
        "Storage Size (MB)": (stats.storageSize / (1024 * 1024)).toFixed(2),
        "Index Size (MB)": (stats.totalIndexSize / (1024 * 1024)).toFixed(2),
      });
    }
    
    // Sort by storage size descending
    statsList.sort((a, b) => parseFloat(b["Storage Size (MB)"]) - parseFloat(a["Storage Size (MB)"]));
    
    console.log("\n=== COLLECTION STORAGE DETAILS (Sorted by Storage Size) ===");
    console.table(statsList);

    const dbStats = await db.command({ dbStats: 1 });
    console.log("\n=== DATABASE TOTALS ===");
    console.log(`Collections: ${dbStats.collections}`);
    console.log(`Documents (All): ${dbStats.objects}`);
    console.log(`Data Size (Uncompressed): ${(dbStats.dataSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Storage Size (On Disk): ${(dbStats.storageSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Index Size: ${(dbStats.indexSize / (1024 * 1024)).toFixed(2)} MB`);

  } catch (error) {
    console.error("Error inspecting database storage:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

run();
