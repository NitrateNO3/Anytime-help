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

const emitChange = (req, payload) => {
  const io = req.app.get('io');
  if (io) io.emit('story_changed', payload);
};

// @route GET /api/stories
// @desc  Active stories grouped by category, plus categories the caller may post in
router.get('/', auth, async (req, res) => {
  try {
    const me = String(req.user._id);
    const [stories, categories, perm] = await Promise.all([
      Story.find({ expiresAt: { $gt: new Date() } }).sort({ createdAt: 1 }).lean(),
      Category.find().sort({ order: 1 }).select('title title_hi title_hinglish image order').lean(),
      getPostableCategories(req.user),
    ]);

    const catMeta = new Map(categories.map(c => [c.title.toLowerCase(), c]));
    const groups = new Map();
    for (const s of stories) {
      const key = s.category.toLowerCase();
      if (!groups.has(key)) {
        const meta = catMeta.get(key);
        groups.set(key, {
          category: meta ? meta.title : s.category,
          title_hi: meta?.title_hi || '',
          title_hinglish: meta?.title_hinglish || '',
          image: meta?.image || '',
          order: meta?.order ?? 9999,
          stories: [],
        });
      }
      const viewers = (s.viewers || []).map(String);
      groups.get(key).stories.push({
        _id: s._id,
        category: s.category,
        author: s.author,
        author_name: s.author_name,
        media_type: s.media_type,
        media_url: s.media_url,
        caption: s.caption,
        bg_color: s.bg_color,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        seen: viewers.includes(me),
        is_mine: String(s.author) === me,
        // Only the author sees how many people viewed
        ...(String(s.author) === me ? { view_count: viewers.length } : {}),
      });
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
    res.json({ groups: result, can_post: postable.length > 0, postable_categories: postable });
  } catch (err) {
    console.error('Error fetching stories:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route POST /api/stories
// @desc  Staff posts a story in one of their own categories
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    if (req.user.role !== 'Staff') {
      return res.status(403).json({ msg: 'Only staff can post stories' });
    }
    const category = String(req.body.category || '').trim();
    if (!category) return res.status(400).json({ msg: 'Category is required' });

    const perm = await getPostableCategories(req.user);
    if (!canPostIn(perm, category)) {
      return res.status(403).json({ msg: 'You can only post stories in your own category' });
    }

    const caption = String(req.body.caption || '').trim().slice(0, 700);
    const story = new Story({
      category,
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
    emitChange(req, { action: 'create', category, id: saved._id });
    res.json(saved);
  } catch (err) {
    console.error('Error posting story:', err);
    res.status(500).json({ msg: 'Could not post story' });
  }
});

// @route POST /api/stories/:id/view
router.post('/:id/view', auth, async (req, res) => {
  try {
    await Story.updateOne({ _id: req.params.id }, { $addToSet: { viewers: req.user._id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route DELETE /api/stories/:id
// @desc  Author or admin deletes a story
router.delete('/:id', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ msg: 'Story not found' });
    const isAuthor = String(story.author) === String(req.user._id);
    const isAdmin = ['Admin', 'SubAdmin'].includes(req.user.role);
    if (!isAuthor && !isAdmin) return res.status(403).json({ msg: 'Not allowed' });

    if (story.public_id) {
      cloudinary.uploader.destroy(story.public_id).catch(() => {});
    }
    await Story.deleteOne({ _id: story._id });
    emitChange(req, { action: 'delete', category: story.category, id: story._id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
