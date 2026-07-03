import mongoose from 'mongoose';
import dotenv from 'dotenv';
import HubInventory from './app/models/hubInventory.js';
import Product from './app/models/product.js';

dotenv.config();

const cleanOrphanedHubInventory = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        // Get all unique product IDs currently in products collection
        const existingProductIds = await Product.distinct('_id');

        // Delete hub inventory rows whose productId is not in existingProductIds
        const result = await HubInventory.deleteMany({
            productId: { $nin: existingProductIds }
        });

        console.log(`Successfully deleted ${result.deletedCount} orphaned Hub Inventory records.`);
        process.exit(0);
    } catch (err) {
        console.error('Error cleaning orphaned records:', err);
        process.exit(1);
    }
};

cleanOrphanedHubInventory();
