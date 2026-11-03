/**
 * Promote an existing account to administrator:
 *   npm run make-admin -- someone@example.com
 */
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');

(async () => {
  const email = (process.argv[2] || '').toLowerCase().trim();
  if (!email) {
    console.error('Usage: npm run make-admin -- <email>');
    process.exit(1);
  }
  if (!env.mongoUri) {
    console.error('MONGODB_URI must be set to promote a user in a persistent database.');
    process.exit(1);
  }
  await connectDB();
  const user = await User.findOneAndUpdate({ email }, { $set: { role: 'admin' } }, { returnDocument: 'after' });
  console.log(user ? `${user.email} is now an administrator.` : `No account found for ${email}. Register first, then re-run.`);
  await disconnectDB();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
