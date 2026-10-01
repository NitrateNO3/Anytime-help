const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://developeraman009:Rz9aGkX1BtzF1zC8@cluster0.db5o3.mongodb.net/Anytime_help?retryWrites=true&w=majority').then(async () => {
  const User = require('./models/User');
  const Complaint = require('./models/Complaint');
  const user = await User.findOne({ phone_number: '+918076993834', role: 'Staff' });
  console.log('Found user:', user ? user.name : 'null');
  
  const allStaffAccounts = await User.find({ phone_number: '+918076993834', role: 'Staff' });
  console.log('All Staff accounts for this number:', allStaffAccounts.map(a => ({ role: a.role, phase: a.phase, categories: a.assigned_categories, cat: a.assigned_category })));
  
  const staffOrConditions = [];
  for (const account of allStaffAccounts) {
    const cats = account.assigned_categories && account.assigned_categories.length > 0 ? account.assigned_categories : (account.assigned_category ? [account.assigned_category] : []);
    let accountCondition = {};
    if (cats.length > 0 && !cats.includes('All')) {
      accountCondition.category = { $in: cats };
    }
    if (account.phase && account.phase !== 'All' && account.phase !== 'Universal' && account.phase !== 'All Groups' && account.phase !== 'All Phases') {
      if (account.phase === 'Sushant Lok 2 - C,D,E' || account.phase === 'Sushant Lok 2 Option 1') {
        accountCondition.phase = { $in: ['Sushant Lok 2 - C,D,E', 'Sushant Lok 2 Option 1'] };
      } else if (account.phase === 'Sushant Lok 2 - F,G' || account.phase === 'Sushant Lok 2 Option 2') {
        accountCondition.phase = { $in: ['Sushant Lok 2 - F,G', 'Sushant Lok 2 Option 2'] };
      } else {
        accountCondition.phase = account.phase;
      }
    }
    staffOrConditions.push(accountCondition);
  }
  
  console.log('staffOrConditions:', JSON.stringify(staffOrConditions, null, 2));
  
  // Test what happens if we query with this
  const query = { status: { $in: ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'DONE'] } };
  
  if (staffOrConditions.length > 0) {
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: staffOrConditions }];
      delete query.$or;
    } else {
      query.$or = staffOrConditions;
    }
  }
  
  console.log('Final query:', JSON.stringify(query, null, 2));
  
  const matches = await Complaint.find(query).countDocuments();
  console.log('Complaints matching query:', matches);
  
  // What if we did regex for phase?
  const staffOrConditionsRegex = [];
  for (const account of allStaffAccounts) {
    const cats = account.assigned_categories && account.assigned_categories.length > 0 ? account.assigned_categories : (account.assigned_category ? [account.assigned_category] : []);
    let accountCondition = {};
    if (cats.length > 0 && !cats.includes('All')) {
      accountCondition.category = { $in: cats };
    }
    if (account.phase && account.phase !== 'All' && account.phase !== 'Universal' && account.phase !== 'All Groups' && account.phase !== 'All Phases') {
      if (account.phase === 'Sushant Lok 2 - C,D,E' || account.phase === 'Sushant Lok 2 Option 1') {
        accountCondition.phase = { $in: ['Sushant Lok 2 - C,D,E', 'Sushant Lok 2 Option 1'] };
      } else if (account.phase === 'Sushant Lok 2 - F,G' || account.phase === 'Sushant Lok 2 Option 2') {
        accountCondition.phase = { $in: ['Sushant Lok 2 - F,G', 'Sushant Lok 2 Option 2'] };
      } else {
        const cleanPhase = account.phase.split(':')[0].trim();
        accountCondition.phase = { $regex: cleanPhase, $options: 'i' };
      }
    }
    staffOrConditionsRegex.push(accountCondition);
  }
  
  const queryRegex = { status: { $in: ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'DONE'] }, $or: staffOrConditionsRegex };
  const matchesRegex = await Complaint.find(queryRegex).countDocuments();
  console.log('Complaints matching regex query:', matchesRegex);
  
  process.exit(0);
});
