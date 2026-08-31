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
      { email: 'test@staff.com', name: 'Test Staff', category: 'Electricity' },
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

    // Partner (PaidStaff)
    let partner = await User.findOne({ email: 'test@partner.com' });
    if (!partner) {
      await User.create({
        name: 'Test Partner',
        email: 'test@partner.com',
        password: hashedPassword,
        role: 'PaidStaff',
        phone_number: '9999999999' // PaidStaff often need phone number in app
      });
      console.log('Partner (PaidStaff) created');
    }

    // Admin
    let admin = await User.findOne({ email: 'admin@anytimehelp.com' });
    if (!admin) {
      const adminSalt = await bcrypt.genSalt(10);
      const adminHashedPassword = await bcrypt.hash('anytime@123', adminSalt);
      await User.create({
        name: 'Super Admin',
        email: 'admin@anytimehelp.com',
        password: adminHashedPassword,
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
