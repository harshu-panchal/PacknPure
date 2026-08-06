import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

console.log("DEFAULT_HUB_LAT:", process.env.DEFAULT_HUB_LAT);
console.log("DEFAULT_HUB_LNG:", process.env.DEFAULT_HUB_LNG);
console.log("HUB_LOCATION_LAT:", process.env.HUB_LOCATION_LAT);
console.log("HUB_LOCATION_LNG:", process.env.HUB_LOCATION_LNG);

console.log("MONGO_URI:", process.env.MONGO_URI);
process.exit(0);
