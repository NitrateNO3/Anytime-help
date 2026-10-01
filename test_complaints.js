const mongoose = require('mongoose');
const User = require('./backend/models/User');

const run = async () => {
  await mongoose.connect('mongodb+srv://developeraman009:Rz9aGkX1BtzF1zC8@cluster0.db5o3.mongodb.net/Anytime_help?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const allStaffAccounts = await User.find({ phone_number: '+918076993834', role: 'Staff' });
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
  
  console.log(JSON.stringify(staffOrConditions, null, 2));
  process.exit(0);
};

run().catch(console.error);
