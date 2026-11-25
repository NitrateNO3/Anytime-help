const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadToS3, deleteFromS3 } = require('../utils/s3Uploader');
const SponsoredAd = require('../models/SponsoredAd');
const auth = require('../middleware/auth');

// Sponsored ads are universal (same in every area), so only the platform
// Super Admin may change them.
const superAdminOnly = (req, res, next) => {
  if (!req.isSuperAdmin) return res.status(403).json({ msg: 'Only the Super Admin can manage sponsored ads' });
  next();
};
const canManage = [auth, superAdminOnly];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Same keys as the app and the admin panel
const THEMES = ['amber', 'blue', 'green', 'pink', 'purple', 'teal', 'orange', 'red'];
const ICONS = [
  'megaphone-outline', 'cafe-outline', 'airplane-outline', 'barbell-outline', 'restaurant-outline',
  'cart-outline', 'shirt-outline', 'car-outline', 'school-outline', 'medkit-outline', 'home-outline',
  'construct-outline', 'gift-outline', 'pricetag-outline', 'paw-outline', 'cut-outline',
];

// Universal: tell every connected client, not just one area.
// (`io.emit` is area scoped by utils/areaSocket.js; `io.sockets` is not.)
const notifySocket = (req) => {
  try {
    const io = req.app.get('io');
    if (io) io.sockets.emit('sponsored_ads_changed');
  } catch (e) {
    console.error('Socket emit error:', e);
  }
};

const toBool = (v) => v === true || v === 'true';

// Only web links, phone and WhatsApp links may be opened from the app
const cleanLink = (raw) => {
  const link = String(raw || '').trim();
  if (!link) return '';
  if (/^(https?:\/\/|tel:|mailto:)/i.test(link)) return link;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(link)) return `https://${link}`;
  return null;
};

// Returns an error message, or null when fine
const applyFields = (doc, body) => {
  if (body.title !== undefined) doc.title = String(body.title).trim().slice(0, 60);
  if (body.sub !== undefined) doc.sub = String(body.sub).trim().slice(0, 100);
  if (body.icon !== undefined) doc.icon = ICONS.includes(body.icon) ? body.icon : ICONS[0];
  if (body.theme !== undefined) doc.theme = THEMES.includes(body.theme) ? body.theme : THEMES[0];
  if (body.order !== undefined && body.order !== '') doc.order = Number(body.order) || 0;
  if (body.isActive !== undefined) doc.isActive = toBool(body.isActive);
  if (body.link !== undefined) {
    const link = cleanLink(body.link);
    if (link === null) return 'Link must be a website (https://...), tel: or mailto: link';
    doc.link = link;
  }
  if (!doc.title) return 'Title is required';
  return null;
};

// @route   GET /api/sponsored-ads
// @desc    App: { ads: active ads, configured: whether any ad exists at all,
//          so the app shows its sample ads only before the first one is added }
//          Admin (?all=true): { ads incl. hidden, icons, themes }
// @access  Public
router.get('/', async (req, res) => {
  try {
    if (req.query.all === 'true') {
      const ads = await SponsoredAd.find({}).sort({ order: 1, createdAt: -1 });
      return res.json({ ads, icons: ICONS, themes: THEMES });
    }
    const [ads, total] = await Promise.all([
      SponsoredAd.find({ isActive: true }).sort({ order: 1, createdAt: -1 }),
      SponsoredAd.estimatedDocumentCount(),
    ]);
    res.json({ ads, configured: total > 0 });
  } catch (err) {
    console.error('Error fetching sponsored ads:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/sponsored-ads
// @desc    Create an ad (multipart, optional `image` file)
// @access  Super Admin
router.post('/', canManage, upload.single('image'), async (req, res) => {
  try {
    const ad = new SponsoredAd({});
    const error = applyFields(ad, req.body);
    if (error) return res.status(400).json({ msg: error });
    if (req.body.isActive === undefined) ad.isActive = true;
    if (req.file) {
      const result = await uploadToS3(req.file.buffer, 'sponsored-ads');
      ad.url = result.secure_url;
      ad.public_id = result.public_id;
    }
    const saved = await ad.save();
    notifySocket(req);
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error creating sponsored ad:', err);
    res.status(500).json({ msg: 'Server error creating ad' });
  }
});

// @route   PUT /api/sponsored-ads/:id
// @desc    Update an ad; send removeImage=true to drop the image
// @access  Super Admin
router.put('/:id', canManage, upload.single('image'), async (req, res) => {
  try {
    const ad = await SponsoredAd.findById(req.params.id);
    if (!ad) return res.status(404).json({ msg: 'Ad not found' });

    const error = applyFields(ad, req.body);
    if (error) return res.status(400).json({ msg: error });

    if (req.file || toBool(req.body.removeImage)) {
      if (ad.public_id) await deleteFromS3(ad.public_id);
      ad.url = '';
      ad.public_id = '';
    }
    if (req.file) {
      const result = await uploadToS3(req.file.buffer, 'sponsored-ads');
      ad.url = result.secure_url;
      ad.public_id = result.public_id;
    }

    const updated = await ad.save();
    notifySocket(req);
    res.json(updated);
  } catch (err) {
    console.error('Error updating sponsored ad:', err);
    res.status(500).json({ msg: 'Server error updating ad' });
  }
});

// @route   PATCH /api/sponsored-ads/:id/toggle
// @access  Super Admin
router.patch('/:id/toggle', canManage, async (req, res) => {
  try {
    const ad = await SponsoredAd.findById(req.params.id);
    if (!ad) return res.status(404).json({ msg: 'Ad not found' });
    ad.isActive = !ad.isActive;
    await ad.save();
    notifySocket(req);
    res.json(ad);
  } catch (err) {
    console.error('Error toggling sponsored ad:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE /api/sponsored-ads/:id
// @access  Super Admin
router.delete('/:id', canManage, async (req, res) => {
  try {
    const ad = await SponsoredAd.findById(req.params.id);
    if (!ad) return res.status(404).json({ msg: 'Ad not found' });
    if (ad.public_id) await deleteFromS3(ad.public_id);
    await SponsoredAd.deleteOne({ _id: ad._id });
    notifySocket(req);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting sponsored ad:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
