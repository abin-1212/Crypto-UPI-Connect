
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const ensureWallets = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const users = await User.find({});
        console.log(`Found ${users.length} users. Checking for missing wallets...`);

        let updatedCount = 0;

        for (const user of users) {
            let needsUpdate = false;

            // 1. Generate Wallet ID if missing
            if (!user.walletId) {
                const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                const cleanName = user.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
                user.walletId = `${cleanName}${randomSuffix}.wallet`;
                console.log(`   + Generated ID for ${user.email}: ${user.walletId}`);
                needsUpdate = true;
            }

            // 2. Initialize Crypto Balance if missing or partial
            if (!user.cryptoBalance || !user.cryptoBalance.usdc) {
                user.cryptoBalance = {
                    usdc: 1000,
                    dai: 500,
                    eth: 0.1
                };
                console.log(`   + Initialized balance for ${user.email}`);
                needsUpdate = true;
            }

            if (needsUpdate) {
                await user.save();
                updatedCount++;
            }
        }

        console.log(`\n🎉 Process Complete. Updated ${updatedCount} users.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

ensureWallets();
