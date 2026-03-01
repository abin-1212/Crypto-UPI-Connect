import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';

dotenv.config();

async function resetWallets() {
    try {
        console.log('🧹 Connecting to MongoDB to reset wallets...', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Clear wallet fields for ALL users
        const result = await User.updateMany(
            {},
            {
                $set: {
                    wallet: {
                        address: "",
                        type: "",
                        isConnected: false,
                        connectedAt: null,
                        lastUsedAddress: ""
                    },
                    walletAddress: "", // Clear legacy field too
                    walletHistory: []   // Optional: Clear history or keep it? Let's clear for fresh start
                }
            }
        );

        console.log(`✅ Successfully reset wallets for ${result.modifiedCount} users.`);
        console.log('All users must now reconnect their individual wallets.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Reset failed:', error);
        process.exit(1);
    }
}

resetWallets();
