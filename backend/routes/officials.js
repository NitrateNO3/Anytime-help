const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Official = require('../models/Official');

// Only the platform Super Admin may manage officials (area admins / sub-admins may not)
const isSuperAdmin = (req) => !!req.isSuperAdmin;

// Compare phone numbers on their last 10 digits (ignores +91, spaces, dashes)
const normalizePhone = (v) => String(v || '').replace(/\D/g, '').slice(-10);

// The logged-in user IS this official: their login number matches the phone the
// Super Admin saved on the official. Such a user may post on that official's page.
const isOwnOfficial = (req, o) => {
  const target = normalizePhone(o && o.phone);
  if (target.length < 10 || !req.user) return false;
  const mine = [req.user.phone_number, ...(req.user.login_phones || [])].map(normalizePhone);
  return mine.includes(target);
};

const canPostAs = (req, o) => isSuperAdmin(req) || isOwnOfficial(req, o);

const toPublic = (o, req) => {
  const me = req.user && req.user._id;
  const followers = (o.followers || []).map(String);
  return {
    _id: o._id,
    name: o.name,
    designation: o.designation,
    ward: o.ward,
    bio: o.bio || '',
    // The official's number is private: only the Super Admin sees it
    ...(isSuperAdmin(req) ? { phone: o.phone } : {}),
    photo: o.photo,
    verified: o.verified,
    order: o.order,
    is_active: o.is_active,
    followers_count: followers.length,
    is_following: me ? followers.includes(String(me)) : false,
    is_mine: isOwnOfficial(req, o),
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
    res.json(list.map(o => toPublic(o, req)));
  } catch (err) {
    console.error('Error fetching officials:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

const pickFields = (body) => {
  const out = {};
  for (const k of ['name', 'designation', 'ward', 'bio', 'phone', 'photo']) {
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
    res.json(toPublic(saved.toObject(), req));
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
    res.json(toPublic(updated, req));
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
    res.json(toPublic(updated, req));
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
};
router.post('/:id/follow', auth, setFollow(true));
router.post('/:id/unfollow', auth, setFollow(false));

// ==========================================
// OFFICIAL POSTS (updates on an official's page)
// ==========================================
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const OfficialPost = require('../models/OfficialPost');
const User = require('../models/User');
const { runUnscoped } = require('../utils/areaContext');
const { sendPushNotifications } = require('../utils/push');

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const CLOUD_OPTS = { folder: 'anytime_help/official_posts', quality: 'auto', fetch_format: 'auto', width: 1200, crop: 'limit' };

const uploadImage = (req) => {
  if (req.file) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(CLOUD_OPTS, (err, result) => (result ? resolve(result) : reject(err)));
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });
  }
  const dataUri = typeof req.body.image === 'string' && req.body.image.startsWith('data:image/') ? req.body.image : null;
  return dataUri ? cloudinary.uploader.upload(dataUri, CLOUD_OPTS) : Promise.resolve(null);
};

const REACTIONS = ['like', 'love', 'celebrate'];

const postToPublic = (p, me) => {
  const counts = {};
  const mine = [];
  for (const r of REACTIONS) {
    const ids = (p.reactions?.[r] || []).map(String);
    counts[r] = ids.length;
    if (me && ids.includes(String(me))) mine.push(r);
  }
  return { _id: p._id, official: p.official, text: p.text, image_url: p.image_url, createdAt: p.createdAt, counts, my_reactions: mine };
};

const emitPostChange = (req, officialId) => {
  const io = req.app.get('io');
  if (io && io.sockets) io.sockets.emit('official_post_changed', { officialId: String(officialId) });
};

// @route GET /api/officials/:id/posts  (newest first)
router.get('/:id/posts', auth, async (req, res) => {
  try {
    const official = await Official.findById(req.params.id).lean();
    if (!official || (!official.is_active && !isSuperAdmin(req))) return res.status(404).json({ msg: 'Official not found' });
    const limit = Math.min(50, Number(req.query.limit) || 30);
    const query = { official: official._id };
    if (req.query.before) query.createdAt = { $lt: new Date(req.query.before) };
    const posts = await OfficialPost.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({
      official: toPublic(official, req),
      can_post: canPostAs(req, official),
      posts: posts.map(p => postToPublic(p, req.user._id)),
      has_more: posts.length === limit,
    });
  } catch (err) {
    console.error('Error fetching official posts:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route POST /api/officials/:id/posts  (Super Admin, or the official themself; text and/or image)
router.post('/:id/posts', auth, upload.single('image'), async (req, res) => {
  try {
    const official = await Official.findById(req.params.id);
    if (!official) return res.status(404).json({ msg: 'Official not found' });
    if (!canPostAs(req, official)) return res.status(403).json({ msg: 'Only this official or the Super Admin can post here' });
    const text = String(req.body.text || '').trim().slice(0, 3000);
    const img = await uploadImage(req);
    if (!text && !img) return res.status(400).json({ msg: 'Add some text or a photo' });

    const post = await new OfficialPost({
      official: official._id,
      text,
      image_url: img?.secure_url || '',
      public_id: img?.public_id || '',
      created_by: req.user._id,
    }).save();

    emitPostChange(req, official._id);
    res.json(postToPublic(post.toObject(), req.user._id));

    // Notify followers from every area (User is area-scoped, so look up unscoped)
    if (official.is_active && official.followers.length) {
      runUnscoped(async () => {
        try {
          const users = await User.find({ _id: { $in: official.followers, $ne: req.user._id }, expoPushToken: { $exists: true, $ne: '' } })
            .select('expoPushToken').lean();
          const tokens = users.map(u => u.expoPushToken);
          const body = text ? text.slice(0, 140) : 'Posted a new photo';
          await sendPushNotifications(tokens, official.name, body, { type: 'official_post', officialId: String(official._id) });
        } catch (e) {
          console.error('Official post push failed:', e.message);
        }
      });
    }
  } catch (err) {
    console.error('Error creating official post:', err);
    if (!res.headersSent) res.status(500).json({ msg: 'Could not post update' });
  }
});

// @route DELETE /api/officials/posts/:postId  (Super Admin, or the official themself)
router.delete('/posts/:postId', auth, async (req, res) => {
  try {
    const post = await OfficialPost.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    const official = await Official.findById(post.official).lean();
    if (!canPostAs(req, official)) return res.status(403).json({ msg: 'Not allowed' });
    if (post.public_id) cloudinary.uploader.destroy(post.public_id).catch(() => {});
    await OfficialPost.deleteOne({ _id: post._id });
    emitPostChange(req, post.official);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route POST /api/officials/posts/:postId/react  { type: 'like' | 'love' | 'celebrate' }  (toggle)
router.post('/posts/:postId/react', auth, async (req, res) => {
  try {
    const type = String(req.body.type || '');
    if (!REACTIONS.includes(type)) return res.status(400).json({ msg: 'Invalid reaction' });
    const field = `reactions.${type}`;
    const existing = await OfficialPost.findOne({ _id: req.params.postId, [field]: req.user._id }).select('_id').lean();
    const update = existing ? { $pull: { [field]: req.user._id } } : { $addToSet: { [field]: req.user._id } };
    const post = await OfficialPost.findOneAndUpdate({ _id: req.params.postId }, update, { new: true }).lean();
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    res.json(postToPublic(post, req.user._id));
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
