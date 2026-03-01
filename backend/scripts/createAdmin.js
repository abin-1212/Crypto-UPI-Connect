import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../src/models/User.js';
import connectDB from '../src/config/db.js';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const createAdmin = async () => {
    try {
        await connectDB();

        const adminEmail = 'admin@convergex.com';
        const adminPassword = 'admin@123';

        // Check if admin exists
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            if (existingAdmin.role === 'admin') {
                console.log('✅ Admin user already exists');
                process.exit(0);
            } else {
                console.log('⚠️ User exists but not admin. Updating role...');
                existingAdmin.role = 'admin';
                await existingAdmin.save();
                console.log('✅ User promoted to admin');
                process.exit(0);
            }
        }

        // Create new admin
        const admin = new User({
            name: 'ConvergeX Admin',
            email: adminEmail,
            password: adminPassword,
            role: 'admin',
            isActive: true,
            kycStatus: 'verified'
        });

        await admin.save();
        console.log('✅ Admin user created successfully');
        console.log('📧 Email:', adminEmail);
        console.log('🔑 Password:', adminPassword);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin:', error);
        process.exit(1);
    }
};

createAdmin();
