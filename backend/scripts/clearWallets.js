import '../src/config/env.js';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';

await connectDB();

// Show current state
const users = await User.find({}).select('name email walletAddress walletVerified');
console.log('\n=== BEFORE: All users with wallet addresses ===');
users.forEach(u => {
  console.log(`  ${u.name} (${u.email}) → wallet: ${u.walletAddress || 'NONE'}, verified: ${u.walletVerified}`);
});

// Clear ALL wallet associations from old accounts
const result = await User.updateMany(
  {},
  { $unset: { walletAddress: 1 }, $set: { walletVerified: false } }
);
console.log(`\n✅ Cleared wallet addresses from ${result.modifiedCount} users`);

// Verify
const after = await User.find({}).select('name email walletAddress walletVerified');
console.log('\n=== AFTER: All users ===');
after.forEach(u => {
  console.log(`  ${u.name} (${u.email}) → wallet: ${u.walletAddress || 'NONE'}, verified: ${u.walletVerified}`);
});

process.exit(0);
