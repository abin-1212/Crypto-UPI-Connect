import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';

dotenv.config();

async function migrateWallets() {
    try {
        console.log('Connecting to MongoDB...', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Add wallet field to all users
        const result = await User.updateMany(
            { wallet: { $exists: false } },
            {
                $set: {
                    wallet: {
                        address: "",
                        type: "",
                        isConnected: false,
                        connectedAt: null
                    },
                    walletHistory: []
                }
            }
        );

        console.log(`✅ Updated ${result.modifiedCount} users with wallet fields`);
        console.log('Detailed result:', result);
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateWallets();
