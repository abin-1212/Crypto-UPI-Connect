import '../src/config/env.js';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;

const newPass = await bcrypt.hash('123456', 10);

const r1 = await db.collection('users').updateOne(
  { email: 'abinv1212@gmail.com' },
  { $set: { password: newPass } }
);
console.log('abinv1212@gmail.com password reset:', r1.modifiedCount ? 'OK' : 'NOT FOUND');

const r2 = await db.collection('users').updateOne(
  { email: 'alice@test.com' },
  { $set: { password: newPass } }
);
console.log('alice@test.com password reset:', r2.modifiedCount ? 'OK' : 'NOT FOUND');

console.log('\nBoth passwords set to: 123456');
await mongoose.disconnect();
process.exit(0);
