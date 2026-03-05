import '../src/config/env.js';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;

console.log('=== USERS ===');
const users = await db.collection('users').find({}, { projection: { name: 1, email: 1 } }).toArray();
for (const u of users) {
  console.log(`  ${u._id} | ${u.name} | ${u.email}`);
}

console.log('\n=== BANK ACCOUNTS ===');
const accounts = await db.collection('bankaccounts').find({}).toArray();
for (const a of accounts) {
  console.log(`  userId: ${a.userId} | UPI: ${a.upiId} | Balance: ${a.balance}`);
}

// Find users without bank accounts
const userIds = users.map(u => u._id.toString());
const accountUserIds = accounts.map(a => a.userId.toString());
const missing = users.filter(u => !accountUserIds.includes(u._id.toString()));

console.log('\n=== USERS WITHOUT BANK ACCOUNTS ===');
if (missing.length === 0) {
  console.log('  None! All users have accounts.');
} else {
  for (const m of missing) {
    console.log(`  MISSING: ${m.name} (${m.email})`);
    const emailPrefix = (m.email || 'user').split('@')[0];
    const upiId = `${emailPrefix}@cxpay`;
    // Check if UPI ID already taken
    const existing = await db.collection('bankaccounts').findOne({ upiId });
    if (existing) {
      console.log(`    UPI ${upiId} already taken, using ${emailPrefix}_${Date.now()}@cxpay`);
      const altUpi = `${emailPrefix}_${Date.now()}@cxpay`;
      await db.collection('bankaccounts').insertOne({
        userId: m._id,
        upiId: altUpi,
        accountNumber: `CX${Date.now()}${Math.floor(Math.random() * 1000)}`,
        balance: 10000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`    ✅ Created with UPI: ${altUpi}`);
    } else {
      await db.collection('bankaccounts').insertOne({
        userId: m._id,
        upiId,
        accountNumber: `CX${Date.now()}${Math.floor(Math.random() * 1000)}`,
        balance: 10000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`    ✅ Created with UPI: ${upiId} | Balance: ₹10,000`);
    }
  }
}

await mongoose.disconnect();
process.exit(0);
