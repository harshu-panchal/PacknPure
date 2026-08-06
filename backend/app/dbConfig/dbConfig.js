import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;
        
        if (!mongoUri) {
            throw new Error('MONGO_URI environment variable is not defined');
        }

        const options = {
            maxPoolSize: 10,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            retryWrites: true,
            w: 'majority',
        };

        await mongoose.connect(mongoUri, options);

        try {
            const { default: Product } = await import('../models/product.js');
            await Product.syncLegacyIndexes();
        } catch (indexErr) {
            console.warn('[Product] Legacy index cleanup:', indexErr.message);
        }

        // First-boot bootstrap only: seed one admin when the DB has none at all.
        // Never re-run for an existing/changed admin — avoids clobbering a real password.
        try {
            const { default: Admin } = await import('../models/admin.js');
            const adminCount = await Admin.countDocuments();
            if (adminCount === 0) {
                const adminEmail = (process.env.ADMIN_EMAIL || "admin@gmail.com").trim().toLowerCase();
                const adminPassword = process.env.ADMIN_PASSWORD || "123456";
                await Admin.create({
                    name: "Master Admin",
                    email: adminEmail,
                    password: adminPassword,
                    role: "admin",
                    isVerified: true
                });
                console.log(`✓ Seeded initial admin account (${adminEmail}) — change this password immediately`);
            }
        } catch (seedErr) {
            console.warn('[Admin Seed]:', seedErr.message);
        }

        console.log('✓ MongoDB connected successfully');
        
        // Connection event listeners
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠ MongoDB disconnected');
        });

        mongoose.connection.on('error', (err) => {
            console.error('✗ MongoDB connection error:', err.message);
        });

    } catch (error) {
        console.error('✗ MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

export default connectDB;