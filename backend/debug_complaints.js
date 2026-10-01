require('dotenv').config();
const mongoose = require('mongoose');
const Complaint = require('./models/Complaint');
const User = require('./models/User');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const staffAccounts = await User.find({ phone_number: '+918076993834', role: 'Staff' });
    const staffOrConditions = [];
    
    for (const account of staffAccounts) {
      let rawCats = account.assigned_categories?.length > 0 ? account.assigned_categories : (account.assigned_category ? [account.assigned_category] : []);
      let cats = [];
      for (const rc of rawCats) {
        if (!rc) continue;
        if (rc.includes(',')) cats.push(...rc.split(',').map(s => s.trim()));
        else cats.push(rc.trim());
      }
      
      let accountCondition = {};
      if (cats.length > 0 && !cats.includes('All')) {
        accountCondition.category = { $in: cats.map(c => new RegExp(`^\\s*${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')) };
      }
      
      if (account.phase && !['All', 'Universal', 'All Groups', 'All Phases'].includes(account.phase)) {
        let phaseCondition;
        if (account.phase.includes('Sushant Lok 2 - C,D,E') || account.phase.includes('Sushant Lok 2 Option 1')) {
          phaseCondition = { $in: [new RegExp('Sushant Lok 2 - C,D,E', 'i'), new RegExp('Sushant Lok 2 Option 1', 'i')] };
        } else if (account.phase.includes('Sushant Lok 2 - F,G') || account.phase.includes('Sushant Lok 2 Option 2')) {
          phaseCondition = { $in: [new RegExp('Sushant Lok 2 - F,G', 'i'), new RegExp('Sushant Lok 2 Option 2', 'i')] };
        } else if (account.phase.includes('Sushant Lok 3')) {
          phaseCondition = new RegExp('Sushant Lok 3', 'i');
        } else {
          phaseCondition = new RegExp(account.phase.replace(/[-:,].*$/, '').trim(), 'i');
        }
        
        if (Object.keys(accountCondition).length > 0) {
          const catCond = accountCondition.category;
          staffOrConditions.push({ category: catCond, phase: phaseCondition });
          staffOrConditions.push({ category: catCond, $or: [{ phase: { $exists: false } }, { phase: null }, { phase: '' }, { phase: 'undefined' }] });
        } else {
          staffOrConditions.push({ phase: phaseCondition });
          staffOrConditions.push({ $or: [{ phase: { $exists: false } }, { phase: null }, { phase: '' }, { phase: 'undefined' }] });
        }
      } else {
        staffOrConditions.push(accountCondition);
      }
    }
    
    const matched = await Complaint.find({ $or: staffOrConditions });
    console.log(`TOTAL MATCHED: ${matched.length}`);
    const grouped = {};
    matched.forEach(c => {
      const key = c.category || 'Unknown';
      grouped[key] = (grouped[key] || 0) + 1;
    });
    console.log('\nBy Category:');
    Object.entries(grouped).forEach(([cat, count]) => console.log(`  ${cat}: ${count} complaints`));
    
    console.log('\nSample (first 10):');
    matched.slice(0, 10).forEach(c => console.log(`  - "${c.title}" | ${c.category} | ${c.phase} | ${c.status}`));
    
    process.exit(0);
  } catch(e) { console.error(e); process.exit(1); }
};
run();
