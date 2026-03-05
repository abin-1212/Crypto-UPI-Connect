/**
 * Ensure all users have a BankAccount document.
 * Creates one with ₹10,000 starting balance if missing.
 */
import '../src/config/env.js';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import BankAccount from '../src/models/BankAccount.js';

await mongoose.connect(process.env.MONGO_URI);

const users = await User.find({});
let created = 0;

for (const user of users) {
  const existing = await BankAccount.findOne({ userId: user._id });
  if (!existing) {
    const emailPrefix = (user.email || 'user').split('@')[0];
    await BankAccount.create({
      userId: user._id,
      upiId: `${emailPrefix}@cxpay`,
      accountNumber: `CX${Date.now()}${Math.floor(Math.random() * 1000)}`,
      balance: 10000,
    });
    console.log(`✅ Created BankAccount for ${user.name} (${user.email}) → ${emailPrefix}@cxpay`);
    created++;
  } else {
    console.log(`✔  ${user.name} (${user.email}) already has account: ${existing.upiId} | ₹${existing.balance}`);
  }
}

console.log(`\nDone. Created ${created} new BankAccount(s).`);
await mongoose.disconnect();
process.exit(0);
