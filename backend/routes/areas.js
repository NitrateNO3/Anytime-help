const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Area = require('../models/Area');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { runUnscoped } = require('../utils/areaContext');

const superAdminOnly = (req, res, next) => {
  if (!req.isSuperAdmin) return res.status(403).json({ msg: 'Access denied: Super Admin only' });
  next();
};

const cleanPhases = (phases) => (Array.isArray(phases) ? phases : [])
  .map((p) => ({
    name: String(p?.name || '').trim(),
    blocks: (Array.isArray(p?.blocks) ? p.blocks : String(p?.blocks || '').split(','))
      .map((b) => String(b).trim())
      .filter(Boolean),
  }))
  .filter((p) => p.name);

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const cleanType = (t) => (t === 'village' ? 'village' : 'sector');
// Villages have no blocks
const phasesFor = (type, phases) => cleanPhases(phases).map((p) => (type === 'village' ? { ...p, blocks: [] } : p));

const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });

// Admins sign in to the admin panel with an OTP sent to this number
const cleanAdminPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (d.length !== 10) throw badRequest('Please enter a valid 10-digit mobile number');
  return `+91${d}`;
};

// One number signs in to one Super Admin portal account
const assertAdminPhoneFree = async (phone, exceptId) => {
  const local = phone.replace(/^\+91/, '');
  const taken = await User.findOne({
    role: { $in: ['SuperAdmin', 'Admin'] },
    $or: [{ phone_number: { $in: [phone, local] } }, { login_phones: { $in: [phone, local] } }],
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  }).select('name').lean().exec();
  if (taken) throw badRequest(`This number is already used by admin "${taken.name || 'Admin'}"`);
};

const createAreaAdmin = async (areaId, { name, phone_number }) => {
  const phone = cleanAdminPhone(phone_number);
  await assertAdminPhoneFree(phone);
  return User.create({ name: (name || '').trim() || 'Admin', phone_number: phone, role: 'Admin', area: areaId });
};

const publicAdmin = (u) => ({ _id: u._id, name: u.name, email: u.email, phone_number: u.phone_number, area: u.area, last_login_at: u.last_login_at });

// @route   GET /api/areas/public
// @desc    Active areas for the app registration screen
// @access  Public
router.get('/public', async (req, res) => {
  try {
    const areas = await Area.find({ is_active: true }).select('name city type phases').sort({ name: 1 });
    res.json(areas);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/areas/current
// @desc    The area the logged-in user is working in (own area, or the one a
//          SuperAdmin selected via x-area-id)
// @access  Private
router.get('/current', auth, async (req, res) => {
  try {
    if (!req.areaId) return res.json(null);
    const area = await Area.findById(req.areaId).select('name city phases is_active');
    res.json(area);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// All routes below: SuperAdmin only, and always across all areas.
router.use(auth, superAdminOnly, (req, res, next) => runUnscoped(() => next()));

// @route   GET /api/areas
// @desc    All areas with their admins and user counts
router.get('/', async (req, res) => {
  try {
    const areas = await Area.find().sort({ createdAt: 1 }).lean();
    const ids = areas.map((a) => a._id);
    const [admins, counts] = await Promise.all([
      User.find({ role: 'Admin', area: { $in: ids } }).select('name email phone_number area last_login_at').lean(),
      User.aggregate([
        { $match: { area: { $in: ids } } },
        { $group: { _id: { area: '$area', role: '$role' }, n: { $sum: 1 } } },
      ]),
    ]);
    res.json(areas.map((a) => {
      const id = String(a._id);
      const stats = {};
      counts.filter((c) => String(c._id.area) === id).forEach((c) => { stats[c._id.role] = c.n; });
      return { ...a, admins: admins.filter((u) => String(u.area) === id).map(publicAdmin), stats };
    }));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/areas
// @desc    Create an area, optionally with its first admin
// @body    { name, city, phases: [{ name, blocks }], admin?: { name, phone_number } }
router.post('/', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ msg: 'Area name is required' });
    if (await Area.findOne({ name })) return res.status(400).json({ msg: 'An area with this name already exists' });

    const admin = req.body.admin;
    if (admin && admin.phone_number) await assertAdminPhoneFree(cleanAdminPhone(admin.phone_number));

    const type = cleanType(req.body.type);
    const area = await Area.create({ name, city: req.body.city || '', type, phases: phasesFor(type, req.body.phases) });
    let createdAdmin = null;
    if (admin && admin.phone_number) createdAdmin = await createAreaAdmin(area._id, admin);

    res.status(201).json({ ...area.toObject(), admins: createdAdmin ? [publicAdmin(createdAdmin)] : [], stats: {} });
  } catch (err) {
    console.error(err.message);
    res.status(err.status || 500).json({ msg: err.status ? err.message : 'Server error' });
  }
});

// @route   PUT /api/areas/:id
// @desc    Update area name / city / phases / active flag
router.put('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ msg: 'Invalid area id' });
    const area = await Area.findById(req.params.id);
    if (!area) return res.status(404).json({ msg: 'Area not found' });

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ msg: 'Area name is required' });
      if (await Area.findOne({ name, _id: { $ne: area._id } })) return res.status(400).json({ msg: 'An area with this name already exists' });
      area.name = name;
    }
    if (req.body.city !== undefined) area.city = req.body.city;
    if (req.body.type !== undefined) area.type = cleanType(req.body.type);
    if (req.body.phases !== undefined || req.body.type !== undefined) {
      area.phases = phasesFor(area.type, req.body.phases !== undefined ? req.body.phases : area.phases);
    }
    if (req.body.is_active !== undefined) area.is_active = !!req.body.is_active;
    await area.save();
    res.json(area);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/areas/:id/admins
// @desc    Add an admin to an area
router.post('/:id/admins', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ msg: 'Invalid area id' });
    const area = await Area.findById(req.params.id);
    if (!area) return res.status(404).json({ msg: 'Area not found' });
    const admin = await createAreaAdmin(area._id, req.body);
    res.status(201).json(publicAdmin(admin));
  } catch (err) {
    console.error(err.message);
    res.status(err.status || 500).json({ msg: err.status ? err.message : 'Server error' });
  }
});

// @route   PUT /api/areas/:id/admins/:userId
// @desc    Update an area admin's name / phone number
router.put('/:id/admins/:userId', async (req, res) => {
  try {
    if (!isValidId(req.params.userId)) return res.status(400).json({ msg: 'Invalid user id' });
    const user = await User.findOne({ _id: req.params.userId, role: 'Admin', area: req.params.id });
    if (!user) return res.status(404).json({ msg: 'Admin not found in this area' });

    const { name, phone_number } = req.body;
    if (phone_number !== undefined) {
      const phone = cleanAdminPhone(phone_number);
      await assertAdminPhoneFree(phone, user._id);
      user.phone_number = phone;
    }
    if (name) user.name = name;
    await user.save();
    res.json(publicAdmin(user));
  } catch (err) {
    console.error(err.message);
    res.status(err.status || 500).json({ msg: err.status ? err.message : 'Server error' });
  }
});

// @route   DELETE /api/areas/:id/admins/:userId
// @desc    Remove an admin from an area
// @route   DELETE /api/areas/:id
// @desc    Delete an empty area (e.g. a test area). Refused while the area has
//          any users, complaints or service bookings, and for the original
//          area. Leftover setup data (categories, banners, ...) is deleted too.
router.delete('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ msg: 'Invalid area id' });
    const area = await Area.findById(req.params.id);
    if (!area) return res.status(404).json({ msg: 'Area not found' });

    const first = await Area.findOne().sort({ createdAt: 1 }).select('_id').lean();
    if (first && String(first._id) === String(area._id)) {
      return res.status(400).json({ msg: 'The original area cannot be deleted' });
    }

    const model = (name) => (mongoose.modelNames().includes(name) ? mongoose.model(name) : null);
    const blockers = [['User', 'users'], ['Complaint', 'complaints'], ['ServiceBooking', 'service bookings']];
    for (const [name, label] of blockers) {
      const M = model(name);
      const n = M ? await M.countDocuments({ area: area._id }) : 0;
      if (n) {
        return res.status(400).json({ msg: `"${area.name}" still has ${n} ${label}. Remove them first, or hide the area instead.` });
      }
    }

    const SETUP_MODELS = [
      'Announcement', 'Banner', 'BottomBanner', 'Category', 'ChatGroup', 'ChatMessage',
      'Community', 'CommunityMessage', 'CommunitySection', 'Department', 'Directory',
      'PaidService', 'StaffBanner',
    ];
    for (const name of SETUP_MODELS) {
      const M = model(name);
      if (M) await M.deleteMany({ area: area._id });
    }
    await area.deleteOne();
    res.json({ msg: `Area "${area.name}" deleted` });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.delete('/:id/admins/:userId', async (req, res) => {
  try {
    if (!isValidId(req.params.userId)) return res.status(400).json({ msg: 'Invalid user id' });
    const user = await User.findOneAndDelete({ _id: req.params.userId, role: 'Admin', area: req.params.id });
    if (!user) return res.status(404).json({ msg: 'Admin not found in this area' });
    res.json({ msg: 'Admin removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
