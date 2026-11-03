// Idempotent startup migration for multi-area support.
//
// 1. Makes sure at least one Area exists (the original society).
// 2. Assigns every document that has no area yet to that first area.
// 3. Drops old globally-unique indexes that are now unique per area.
//
// Safe to run on every boot: once everything has an area it is a no-op.
const mongoose = require('mongoose');
const Area = require('../models/Area');
const { runUnscoped, setDefaultArea } = require('./areaContext');

const SCOPED_MODELS = [
  'Announcement', 'Banner', 'BottomBanner', 'Category', 'ChatGroup', 'ChatMessage',
  'Community', 'CommunityMessage', 'CommunitySection', 'Complaint', 'Department',
  'Directory', 'PaidService', 'ServiceBooking', 'StaffBanner', 'User',
];

// collection -> old single-field unique index name
const OLD_UNIQUE_INDEXES = {
  categories: 'title_1',
  departments: 'name_1',
  paidservices: 'name_1',
};

const DEFAULT_AREA = {
  name: process.env.DEFAULT_AREA_NAME || 'Sushant Lok',
  city: 'Gurugram',
  phases: [
    { name: 'Sushant Lok 2', blocks: ['C', 'D', 'E', 'F', 'G'] },
    { name: 'Sushant Lok 3', blocks: ['A', 'B', 'B1', 'C', 'D', 'E', 'F', 'G', 'H'] },
  ],
};

async function migrate() {
  await mongoose.connection.asPromise();

  await runUnscoped(async () => {
    let area = await Area.findOne().sort({ createdAt: 1 });
    if (!area) {
      area = await Area.create(DEFAULT_AREA);
      console.log(`[areas] Created default area "${area.name}" (${area._id})`);
    }
    setDefaultArea(area._id);

    for (const name of SCOPED_MODELS) {
      const Model = mongoose.model(name);
      const filter = { area: { $exists: false } };
      if (name === 'User') filter.role = { $ne: 'SuperAdmin' };
      const res = await Model.collection.updateMany(filter, { $set: { area: area._id } });
      if (res.modifiedCount) console.log(`[areas] ${name}: assigned ${res.modifiedCount} docs to "${area.name}"`);
    }

    for (const [collection, index] of Object.entries(OLD_UNIQUE_INDEXES)) {
      try {
        await mongoose.connection.collection(collection).dropIndex(index);
        console.log(`[areas] Dropped old unique index ${collection}.${index}`);
      } catch (_) { /* already gone */ }
    }

    // Build the new per-area compound indexes now that old ones are gone.
    for (const name of ['Category', 'Department', 'PaidService']) {
      await mongoose.model(name).createIndexes().catch((e) =>
        console.error(`[areas] createIndexes ${name}:`, e.message));
    }
  });
}

module.exports = () => migrate().catch((err) => console.error('[areas] migration failed:', err));
