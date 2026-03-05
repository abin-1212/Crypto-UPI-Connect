// Test the sign → verify flow to diagnose mismatches
import '../src/config/env.js';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import { ethers } from 'ethers';

await connectDB();

// Use abinv's nonce
const user = await User.findOne({ email: 'abinv1212@gmail.com' }).select('+walletNonce +walletAddress');
console.log('User:', user.name, user.email);
console.log('DB walletAddress:', user.walletAddress);
console.log('DB walletNonce:', user.walletNonce);

// Generate the same message as the server
const message = `ConvergeX Pay — Verify wallet ownership\n\nNonce: ${user.walletNonce}\n\nThis signature does not trigger a blockchain transaction or cost any gas.`;
console.log('\nMessage to sign:');
console.log(JSON.stringify(message));
console.log('Message bytes length:', Buffer.from(message, 'utf8').length);
console.log('Message .length:', message.length);

// Sign with a test wallet (simulating MetaMask)
const testWallet = ethers.Wallet.createRandom();
console.log('\nTest wallet address:', testWallet.address);

const signature = await testWallet.signMessage(message);
console.log('Signature:', signature.substring(0, 20) + '...');

// Verify - same as backend does
const recovered = ethers.utils.verifyMessage(message, signature);
console.log('Recovered address:', recovered);
console.log('Match:', recovered.toLowerCase() === testWallet.address.toLowerCase());

// Now test with the SERVER wallet (the one in .env)
const serverKey = process.env.SERVER_WALLET_PRIVATE_KEY;
if (serverKey) {
    const serverWallet = new ethers.Wallet(serverKey);
    console.log('\n--- Server wallet test ---');
    console.log('Server wallet address:', serverWallet.address);
    
    const sig2 = await serverWallet.signMessage(message);
    const recovered2 = ethers.utils.verifyMessage(message, sig2);
    console.log('Recovered:', recovered2);
    console.log('Match:', recovered2.toLowerCase() === serverWallet.address.toLowerCase());
}

process.exit(0);
