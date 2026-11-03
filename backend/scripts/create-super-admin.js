// Create (or promote) a SuperAdmin account that can manage all areas.
//
// Usage:  node scripts/create-super-admin.js <email> <password> [name]
//
// If a user with that email already exists it is promoted to SuperAdmin and
// its password is reset to the one given.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

(async () => {
  const [email, password, name = 'Super Admin'] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: node scripts/create-super-admin.js <email> <password> [name]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/anytime_help');

  const hash = await bcrypt.hash(password, await bcrypt.genSalt(10));
  let user = await User.findOne({ email: email.trim() });

  if (user) {
    user.role = 'SuperAdmin';
    user.password = hash;
    user.area = undefined;
    await user.save();
    console.log(`Promoted ${user.email} to SuperAdmin`);
  } else {
    user = await User.create({ name, email: email.trim(), password: hash, role: 'SuperAdmin' });
    console.log(`Created SuperAdmin ${user.email}`);
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
