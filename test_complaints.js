const mongoose = require('mongoose');
const Complaint = require('./backend/models/Complaint');
const User = require('./backend/models/User');

const run = async () => {
  try {
    await mongoose.connect('mongodb+srv://developeraman009:Rz9aGkX1BtzF1zC8@cluster0.db5o3.mongodb.net/Anytime_help?retryWrites=true&w=majority');
    console.log('Connected');
    
    // Find staff
    const allStaffAccounts = await User.find({ phone_number: '+918076993834', role: 'Staff' });
    console.log('Found staff accounts:', allStaffAccounts.length);
    
    for (const a of allStaffAccounts) {
      console.log(`Staff Phase: "${a.phase}"`);
      console.log(`Staff Category: "${a.assigned_categories.join(', ')}"`);
    }

    // Check complaints in Sushant Lok 2
    const complaints = await Complaint.find({ category: 'Door to door' }).limit(5);
    console.log('\nSample Complaints for Door to door:');
    for (const c of complaints) {
      console.log(`Title: ${c.title}`);
      console.log(`Phase: "${c.phase}"`);
      console.log(`Status: "${c.status}"`);
      console.log(`Category: "${c.category}"`);
      console.log('---');
    }

    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
};

run();
