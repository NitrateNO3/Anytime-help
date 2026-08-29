const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

const updateAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/anytime_help');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('anytime@123', salt);
    await User.updateOne({ email: 'admin@anytimehelp.com' }, { password: hashedPassword });
    console.log('Admin password updated to anytime@123');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

updateAdmin();
