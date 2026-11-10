const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const auth = require('../middleware/auth');
const Story = require('../models/Story');
const Category = require('../models/Category');
const User = require('../models/User');

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const streamUpload = (fileBuffer) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    { folder: 'anytime_help/stories', quality: 'auto', fetch_format: 'auto', width: 1080, crop: 'limit' },
    (error, result) => (result ? resolve(result) : reject(error))
  );
  streamifier.createReadStream(fileBuffer).pipe(stream);
});

const splitCats = (account) => {
  const raw = (account.assigned_categories && account.assigned_categories.length > 0)
    ? account.assigned_categories
    : (account.assigned_category ? [account.assigned_category] : []);
  const out = [];
  for (const rc of raw) {
    if (typeof rc !== 'string' || !rc.trim()) continue;
    out.push(...rc.split(',').map(s => s.trim()).filter(Boolean));
  }
  return out;
};

// Categories this user may post stories in. A person can hold several Staff
// accounts with the same phone number (one per zone), so merge all of them.
// Returns { all: true } for 'All Complaints' / 'All' staff.
const getPostableCategories = async (user) => {
  if (!user || user.role !== 'Staff') return { all: false, cats: [] };
  let accounts = [user];
  if (user.phone_number) {
    const linked = await User.find({ phone_number: user.phone_number, role: 'Staff' })
      .select('assigned_category assigned_categories').lean();
    if (linked.length) accounts = linked;
  }
  const cats = new Set();
  let all = false;
  for (const acc of accounts) {
    for (const c of splitCats(acc)) {
      const l = c.toLowerCase();
      if (l === 'all complaints' || l === 'all') all = true;
      else cats.add(c);
    }
  }
  return { all, cats: [...cats] };
};

const canPostIn = (perm, category) =>
  perm.all || perm.cats.some(c => c.toLowerCase() === String(category).toLowerCase());

const Official = require('../models/Official');
const { runUnscoped } = require('../utils/areaContext');
const { isSuperAdmin, isOwnOfficial, isInStatusArea } = require('../utils/officialAccess');

// NOTE: run area-unscoped queries with .exec() INSIDE runUnscoped. Returning the bare
// query would execute it later, outside the unscoped context, still area-filtered.

const emitChange = (req, payload, global = false) => {
  const io = req.app.get('io');
  if (!io) return;
  // Official stories reach several areas, so broadcast those to everyone
  if (global && io.sockets) io.sockets.emit('story_changed', payload);
  else io.emit('story_changed', payload);
};

// Officials the caller may post stories as (their login number matches the official's phone)
const getOwnOfficials = async (req) => {
  const list = await Official.find({ phone: { $nin: ['', null] } }).select('name phone verified').lean();
  return list.filter(o => isOwnOfficial(req, o));
};

const shapeStory = (s, me) => {
  const viewers = (s.viewers || []).map(String);
  const mine = String(s.author) === me;
  return {
    _id: s._id,
    category: s.category,
    official: s.official || null,
    author: s.author,
    author_name: s.author_name,
    media_type: s.media_type,
    media_url: s.media_url,
    caption: s.caption,
    bg_color: s.bg_color,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    seen: viewers.includes(me),
    is_mine: mine,
    // Only the author sees how many people viewed
    ...(mine ? { view_count: viewers.length } : {}),
  };
};

// @route GET /api/stories
// @desc  Active stories grouped by category (staff) and by official (followed
//        officials only), plus what the caller may post in
router.get('/', auth, async (req, res) => {
  try {
    const me = String(req.user._id);
    const now = new Date();
    const [stories, categories, perm, ownOfficials] = await Promise.all([
      Story.find({ expiresAt: { $gt: now }, official: null }).sort({ createdAt: 1 }).lean(),
      Category.find().sort({ order: 1 }).select('title title_hi title_hinglish image order').lean(),
      getPostableCategories(req.user),
      getOwnOfficials(req),
    ]);

    // Category (staff) stories, area-scoped
    const catMeta = new Map(categories.map(c => [c.title.toLowerCase(), c]));
    const groups = new Map();
    for (const s of stories) {
      const key = s.category.toLowerCase();
      if (!groups.has(key)) {
        const meta = catMeta.get(key);
        groups.set(key, {
          key,
          kind: 'category',
          category: meta ? meta.title : s.category,
          title_hi: meta?.title_hi || '',
          title_hinglish: meta?.title_hinglish || '',
          image: meta?.image || '',
          stories: [],
        });
      }
      groups.get(key).stories.push(shapeStory(s, me));
    }

    // Official stories: only officials this user follows whose status areas include
    // the user's area, plus the user's own official page. These cross areas, so read unscoped.
    const followed = await Official.find({ is_active: true, followers: req.user._id }).select('name verified all_areas areas is_active phone').lean();
    const officialMap = new Map();
    // Status only in the areas the official was created for
    for (const o of followed) if (isInStatusArea(req, o)) officialMap.set(String(o._id), o);
    for (const o of ownOfficials) officialMap.set(String(o._id), o);
    if (officialMap.size) {
      const offStories = await runUnscoped(async () => Story.find({
        expiresAt: { $gt: now },
        official: { $in: [...officialMap.keys()] },
      }).sort({ createdAt: 1 }).lean().exec());
      for (const s of offStories) {
        const o = officialMap.get(String(s.official));
        const key = `official:${s.official}`;
        if (!groups.has(key)) {
          groups.set(key, { key, kind: 'official', official_id: String(s.official), category: o.name, verified: o.verified !== false, image: '', stories: [] });
        }
        groups.get(key).stories.push(shapeStory(s, me));
      }
    }

    const result = [...groups.values()]
      .map(g => ({
        ...g,
        has_unseen: g.stories.some(s => !s.seen && !s.is_mine),
        latest_at: g.stories[g.stories.length - 1].createdAt,
      }))
      // Unseen first (newest first), then seen
      .sort((a, b) => (Number(b.has_unseen) - Number(a.has_unseen)) || (new Date(b.latest_at) - new Date(a.latest_at)));

    const postable = perm.all ? categories.map(c => c.title) : perm.cats;
    const postableOfficials = ownOfficials.map(o => ({ _id: o._id, name: o.name }));
    res.json({
      groups: result,
      can_post: postable.length > 0 || postableOfficials.length > 0,
      postable_categories: postable,
      postable_officials: postableOfficials,
    });
  } catch (err) {
    console.error('Error fetching stories:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route POST /api/stories
// @desc  Staff posts in one of their own categories, or an official posts as themself
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    let category;
    let officialId = null;

    if (req.body.official) {
      // Posting as an official: the login number must match that official
      const official = await Official.findById(req.body.official).select('name phone').lean();
      if (!official) return res.status(404).json({ msg: 'Official not found' });
      if (!isOwnOfficial(req, official) && !isSuperAdmin(req)) {
        return res.status(403).json({ msg: 'You can only post stories as your own official page' });
      }
      category = official.name;
      officialId = official._id;
    } else {
      if (req.user.role !== 'Staff') {
        return res.status(403).json({ msg: 'Only staff can post stories' });
      }
      category = String(req.body.category || '').trim();
      if (!category) return res.status(400).json({ msg: 'Category is required' });
      const perm = await getPostableCategories(req.user);
      if (!canPostIn(perm, category)) {
        return res.status(403).json({ msg: 'You can only post stories in your own category' });
      }
    }

    const caption = String(req.body.caption || '').trim().slice(0, 700);
    const story = new Story({
      category,
      official: officialId,
      author: req.user._id,
      author_name: req.user.name || '',
      caption,
      bg_color: /^#[0-9a-fA-F]{6}$/.test(req.body.bg_color || '') ? req.body.bg_color : '#2563EB',
    });

    // Photo comes either as a multipart file or as a base64 data URI (the app's usual way)
    const dataUri = typeof req.body.image === 'string' && req.body.image.startsWith('data:image/') ? req.body.image : null;
    if (req.file || dataUri) {
      const result = req.file
        ? await streamUpload(req.file.buffer)
        : await cloudinary.uploader.upload(dataUri, {
          folder: 'anytime_help/stories', quality: 'auto', fetch_format: 'auto', width: 1080, crop: 'limit',
        });
      story.media_type = 'image';
      story.media_url = result.secure_url;
      story.public_id = result.public_id;
    } else {
      if (!caption) return res.status(400).json({ msg: 'Add a photo or some text' });
      story.media_type = 'text';
    }

    const saved = await story.save();
    emitChange(req, { action: 'create', category, id: saved._id }, !!officialId);
    res.json(saved);
  } catch (err) {
    console.error('Error posting story:', err);
    res.status(500).json({ msg: 'Could not post story' });
  }
});

// @route POST /api/stories/:id/view
// (unscoped so an official's story can be marked seen from any area)
router.post('/:id/view', auth, async (req, res) => {
  try {
    const me = req.user._id;
    await runUnscoped(async () => {
      // First view only: record the user and the time. The author's own views don't count.
      await Story.updateOne(
        { _id: req.params.id, author: { $ne: me }, viewers: { $ne: me } },
        { $addToSet: { viewers: me }, $push: { views: { user: me, at: new Date() } } }
      ).exec();
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route GET /api/stories/:id/viewers
// @desc  WhatsApp-style "Viewed by" list: newest first. Author (or Super Admin) only.
router.get('/:id/viewers', auth, async (req, res) => {
  try {
    const result = await runUnscoped(async () => {
      const story = await Story.findById(req.params.id).select('author viewers views').lean().exec();
      if (!story) return { status: 404 };
      if (String(story.author) !== String(req.user._id) && !isSuperAdmin(req)) return { status: 403 };

      const atByUser = new Map((story.views || []).map(v => [String(v.user), v.at]));
      const ids = (story.viewers || []).filter(id => String(id) !== String(story.author));
      // Viewers can be from any area (official stories), so look users up unscoped
      const users = await User.find({ _id: { $in: ids } }).select('name role house_no block phase').lean().exec();
      const byId = new Map(users.map(u => [String(u._id), u]));
      const list = ids.map(id => {
        const u = byId.get(String(id));
        const place = u ? [u.block ? `Block ${u.block}` : '', u.house_no || ''].filter(Boolean).join(', ') : '';
        return { _id: id, name: u?.name || 'Resident', role: u?.role || '', place, at: atByUser.get(String(id)) || null };
      });
      // Newest first; views recorded before times were saved go last
      list.sort((a, b) => (b.at ? new Date(b.at).getTime() : 0) - (a.at ? new Date(a.at).getTime() : 0));
      return { status: 200, list };
    });
    if (result.status === 404) return res.status(404).json({ msg: 'Story not found' });
    if (result.status === 403) return res.status(403).json({ msg: 'Only the author can see who viewed' });
    res.json({ count: result.list.length, viewers: result.list });
  } catch (err) {
    console.error('Error fetching story viewers:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route DELETE /api/stories/:id
// @desc  Author, Super Admin, or (for staff stories) an admin of that area
router.delete('/:id', auth, async (req, res) => {
  try {
    const story = await runUnscoped(async () => Story.findById(req.params.id).exec());
    if (!story) return res.status(404).json({ msg: 'Story not found' });
    const isAuthor = String(story.author) === String(req.user._id);
    const isAreaAdmin = ['Admin', 'SubAdmin'].includes(req.user.role)
      && !story.official
      && !!req.areaId && String(story.area) === String(req.areaId);
    if (!isAuthor && !isSuperAdmin(req) && !isAreaAdmin) return res.status(403).json({ msg: 'Not allowed' });

    if (story.public_id) {
      cloudinary.uploader.destroy(story.public_id).catch(() => {});
    }
    await runUnscoped(async () => Story.deleteOne({ _id: story._id }).exec());
    emitChange(req, { action: 'delete', category: story.category, id: story._id }, !!story.official);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});


module.exports = router;
