const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Official = require('../models/Official');

// Only the platform Super Admin may manage officials (area admins / sub-admins may not)
const isSuperAdmin = (req) => !!req.isSuperAdmin;

const toPublic = (o, me) => {
  const followers = (o.followers || []).map(String);
  return {
    _id: o._id,
    name: o.name,
    designation: o.designation,
    ward: o.ward,
    phone: o.phone,
    photo: o.photo,
    verified: o.verified,
    order: o.order,
    is_active: o.is_active,
    followers_count: followers.length,
    is_following: me ? followers.includes(String(me)) : false,
  };
};

const emitChange = (req) => {
  // Officials are universal, so notify every area (the default io.emit is area-scoped)
  const io = req.app.get('io');
  if (io && io.sockets) io.sockets.emit('officials_updated');
};

// @route GET /api/officials  (Super Admin gets hidden ones too with ?all=true)
router.get('/', auth, async (req, res) => {
  try {
    const query = (req.query.all === 'true' && isSuperAdmin(req)) ? {} : { is_active: true };
    const list = await Official.find(query).sort({ order: 1, createdAt: 1 }).lean();
    res.json(list.map(o => toPublic(o, req.user._id)));
  } catch (err) {
    console.error('Error fetching officials:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

const pickFields = (body) => {
  const out = {};
  for (const k of ['name', 'designation', 'ward', 'phone', 'photo']) {
    if (body[k] !== undefined) out[k] = String(body[k]).trim();
  }
  if (body.order !== undefined) out.order = Number(body.order) || 0;
  if (body.verified !== undefined) out.verified = body.verified === true || body.verified === 'true';
  if (body.is_active !== undefined) out.is_active = body.is_active === true || body.is_active === 'true';
  return out;
};

// @route POST /api/officials  (Super Admin only)
router.post('/', auth, async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ msg: 'Only Super Admin can manage officials' });
  try {
    const fields = pickFields(req.body);
    if (!fields.name) return res.status(400).json({ msg: 'Name is required' });
    const saved = await new Official(fields).save();
    emitChange(req);
    res.json(toPublic(saved.toObject(), req.user._id));
  } catch (err) {
    console.error('Error creating official:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route PUT /api/officials/:id  (Super Admin only)
router.put('/:id', auth, async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ msg: 'Only Super Admin can manage officials' });
  try {
    const updated = await Official.findOneAndUpdate({ _id: req.params.id }, { $set: pickFields(req.body) }, { new: true }).lean();
    if (!updated) return res.status(404).json({ msg: 'Official not found' });
    emitChange(req);
    res.json(toPublic(updated, req.user._id));
  } catch (err) {
    console.error('Error updating official:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route DELETE /api/officials/:id  (Super Admin only)
router.delete('/:id', auth, async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ msg: 'Only Super Admin can manage officials' });
  try {
    await Official.deleteOne({ _id: req.params.id });
    emitChange(req);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route POST /api/officials/:id/follow | /unfollow
const setFollow = (follow) => async (req, res) => {
  try {
    const update = follow ? { $addToSet: { followers: req.user._id } } : { $pull: { followers: req.user._id } };
    const updated = await Official.findOneAndUpdate({ _id: req.params.id, is_active: true }, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ msg: 'Official not found' });
    res.json(toPublic(updated, req.user._id));
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
};
router.post('/:id/follow', auth, setFollow(true));
router.post('/:id/unfollow', auth, setFollow(false));

module.exports = router;
