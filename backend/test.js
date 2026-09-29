const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://admin:aman123@cluster0.v4ppbbd.mongodb.net/anytime_help?retryWrites=true&w=majority')
  .then(async () => {
    const User = require('./models/User');
    const users = await User.find({ role: { $in: ['Resident', 'Member', 'Staff'] }, expoPushToken: { $exists: true, $ne: '' } });
    console.log('Total tokens found:', users.length);
    
    // Also test exactly what the API does for "Members"
    const memberUsers = await User.find({ role: { $in: ['Member'] }, expoPushToken: { $exists: true, $ne: '' } });
    console.log('Total Member tokens found:', memberUsers.length);
    
    // Also test exactly what the API does for "Resident"
    const residentUsers = await User.find({ role: { $in: ['Resident'] }, expoPushToken: { $exists: true, $ne: '' } });
    console.log('Total Resident tokens found:', residentUsers.length);
    
    mongoose.disconnect();
  });
