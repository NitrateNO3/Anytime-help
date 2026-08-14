const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/anytime_help');
    console.log('MongoDB Connected for Seeding');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // Resident
    let resident = await User.findOne({ email: 'test@resident.com' });
    if (!resident) {
      await User.create({
        name: 'Test Resident',
        email: 'test@resident.com',
        password: hashedPassword,
        role: 'Resident'
      });
      console.log('Resident created');
    }

    // Staff
    const staffAccounts = [
      { email: 'plumber@staff.com', name: 'Ramu Plumber', category: 'Plumbing' },
      { email: 'electrician@staff.com', name: 'Shyamu Electrician', category: 'Electrical' },
      { email: 'cleaner@staff.com', name: 'Raju Cleaner', category: 'Cleaning' }
    ];

    for (let s of staffAccounts) {
      let staff = await User.findOne({ email: s.email });
      if (!staff) {
        await User.create({
          name: s.name,
          email: s.email,
          password: hashedPassword,
          role: 'Staff',
          assigned_category: s.category
        });
        console.log(`Staff created: ${s.name} (${s.category})`);
      }
    }

    // Admin
    let admin = await User.findOne({ email: 'admin@anytimehelp.com' });
    if (!admin) {
      await User.create({
        name: 'Super Admin',
        email: 'admin@anytimehelp.com',
        password: hashedPassword,
        role: 'Admin'
      });
      console.log('Admin created: admin@anytimehelp.com');
    }

    console.log('Seeding Complete');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedDB();
