import '../src/config/env.js';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';

await connectDB();

setTimeout(async () => {
  const users = await User.find({}).select('name email walletAddress walletVerified walletNonce');
  console.log('\n=== USER WALLET STATUS ===');
  users.forEach(u => {
    console.log(`${u.name} (${u.email})`);
    console.log(`  wallet: ${u.walletAddress || 'NONE'}`);
    console.log(`  verified: ${u.walletVerified}`);
    console.log(`  nonce: ${u.walletNonce?.substring(0, 16)}...`);
    console.log('');
  });
  process.exit(0);
}, 3000);
