const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB Connected');
    
    // Find all users who either have an expoPushToken or a firebase_uid
    // and mark them as has_logged_in = true
    const result = await User.updateMany(
      { $or: [{ expoPushToken: { $exists: true, $ne: null } }, { firebase_uid: { $exists: true, $ne: null } }] },
      { $set: { has_logged_in: true } }
    );
    
    console.log(`Migration complete. Modified ${result.modifiedCount} users to Active.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Connection Error:', err);
    process.exit(1);
  });
