require('dotenv').config();
const mongoose = require('mongoose');
const Complaint = require('./models/Complaint');
const User = require('./models/User');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const staffAccounts = await User.find({ phone_number: '+918076993834', role: 'Staff' });
    
    let staffOrConditions = [];
    for (const account of staffAccounts) {
      
      let rawCats = account.assigned_categories && account.assigned_categories.length > 0 ? account.assigned_categories : (account.assigned_category ? [account.assigned_category] : []);
      let cats = [];
      for (const rc of rawCats) {
        if (!rc) continue;
        if (typeof rc === 'string' && rc.includes(',')) {
          cats.push(...rc.split(',').map(s => s.trim()));
        } else if (typeof rc === 'string') {
          cats.push(rc.trim());
        }
      }
      
      let accountCondition = {};
      if (cats.length > 0 && !cats.includes('All')) {
        accountCondition.category = { $in: cats.map(c => new RegExp(`^\\s*${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')) };
      }
      
      if (account.phase && account.phase !== 'All' && account.phase !== 'Universal' && account.phase !== 'All Groups' && account.phase !== 'All Phases') {
        if (account.phase.includes('Sushant Lok 2 - C,D,E') || account.phase.includes('Sushant Lok 2 Option 1')) {
          accountCondition.phase = { $in: [
            new RegExp('Sushant Lok 2 - C,D,E', 'i'), 
            new RegExp('Sushant Lok 2 Option 1', 'i')
          ]};
        } else if (account.phase.includes('Sushant Lok 2 - F,G') || account.phase.includes('Sushant Lok 2 Option 2')) {
          accountCondition.phase = { $in: [
            new RegExp('Sushant Lok 2 - F,G', 'i'), 
            new RegExp('Sushant Lok 2 Option 2', 'i')
          ]};
        } else if (account.phase.includes('Sushant Lok 3')) {
          accountCondition.phase = new RegExp('Sushant Lok 3', 'i');
        } else {
          let cleanPhase = account.phase.replace(/[-:,].*$/, '').trim();
          accountCondition.phase = new RegExp(cleanPhase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        }
      }
      staffOrConditions.push(accountCondition);
    }

    let query = { status: 'PENDING' };
    query.$or = staffOrConditions;
    
    console.log(JSON.stringify(query, (key, val) => val instanceof RegExp ? val.toString() : val, 2));

    const matchedComplaints = await Complaint.find(query);
    console.log(`Matched Complaints count: ${matchedComplaints.length}`);
    
    for (const c of matchedComplaints) {
      console.log(`- Title: "${c.title}", Category: "${c.category}", Phase: "${c.phase}"`);
    }

    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
};

run();
