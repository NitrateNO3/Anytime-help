const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Announcement = require('../models/Announcement');

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');

    // 1. Fix Staff assigned_locations
    const staffMembers = await User.find({
      role: { $in: ['Staff', 'PaidStaff', 'SubAdmin'] },
      assigned_locations: { $exists: true, $ne: [] }
    });

    console.log(`Checking ${staffMembers.length} staff/subadmin users...`);
    let staffUpdated = 0;

    for (const staff of staffMembers) {
      let changed = false;
      const newLocations = (staff.assigned_locations || []).map(loc => {
        const rawBlocks = loc.blocks || [];
        const splitBlocks = [];
        for (const b of rawBlocks) {
          if (typeof b === 'string' && b.includes(',')) {
            changed = true;
            splitBlocks.push(...b.split(',').map(s => s.trim().replace(/^block\s*/i, '')).filter(Boolean));
          } else {
            splitBlocks.push(typeof b === 'string' ? b.trim().replace(/^block\s*/i, '') : b);
          }
        }
        return {
          phase: loc.phase,
          blocks: [...new Set(splitBlocks.length > 0 ? splitBlocks : ['ALL'])]
        };
      });

      if (changed) {
        staff.assigned_locations = newLocations;
        console.log(`Updating staff ${staff.name} (${staff.phone_number}):`, JSON.stringify(newLocations));
        await staff.save();
        staffUpdated++;
      }
    }
    console.log(`Staff updated: ${staffUpdated}`);

    // 2. Fix Announcements targetLocations and phases
    const announcements = await Announcement.find({ active: true });
    console.log(`Checking ${announcements.length} active announcements...`);
    let announcementsUpdated = 0;

    for (const ann of announcements) {
      let changed = false;
      const targetLocs = ann.targetLocations || [];
      const newTargetLocs = targetLocs.map(loc => {
        const rawBlocks = loc.blocks || [];
        const splitBlocks = [];
        for (const b of rawBlocks) {
          if (typeof b === 'string' && b.includes(',')) {
            changed = true;
            splitBlocks.push(...b.split(',').map(s => s.trim().replace(/^block\s*/i, '')).filter(Boolean));
          } else {
            splitBlocks.push(typeof b === 'string' ? b.trim().replace(/^block\s*/i, '') : b);
          }
        }
        return {
          phase: loc.phase,
          blocks: [...new Set(splitBlocks.length > 0 ? splitBlocks : ['ALL'])]
        };
      });

      const phSet = new Set(ann.phases || []);
      for (const loc of newTargetLocs) {
        if (loc.phase) {
          phSet.add(loc.phase);
          const isSL2 = loc.phase.toLowerCase().includes('sushant lok 2');
          const hasFG = (loc.blocks || []).some(b => ['F', 'G'].includes(String(b).toUpperCase()));
          const hasCDE = (loc.blocks || []).some(b => ['C', 'D', 'E'].includes(String(b).toUpperCase()));
          if (isSL2 && hasFG && !phSet.has('Sushant Lok 2 - F,G')) {
            phSet.add('Sushant Lok 2 - F,G');
            changed = true;
          }
          if (isSL2 && hasCDE && !phSet.has('Sushant Lok 2 - C,D,E')) {
            phSet.add('Sushant Lok 2 - C,D,E');
            changed = true;
          }
          for (const b of (loc.blocks || [])) {
            if (b && b !== 'ALL' && b !== 'All Blocks') {
              if (!phSet.has(b)) { phSet.add(b); changed = true; }
              if (!phSet.has(`Block ${b}`)) { phSet.add(`Block ${b}`); changed = true; }
            }
          }
        }
      }

      if (changed) {
        ann.targetLocations = newTargetLocs;
        ann.phases = Array.from(phSet);
        console.log(`Updating announcement "${ann.title}":`);
        console.log('  targetLocations:', JSON.stringify(newTargetLocs));
        console.log('  phases:', JSON.stringify(ann.phases));
        await ann.save();
        announcementsUpdated++;
      }
    }
    console.log(`Announcements updated: ${announcementsUpdated}`);

    console.log('Migration finished successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  }
}

run();

