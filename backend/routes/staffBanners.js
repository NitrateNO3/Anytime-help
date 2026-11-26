const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const multer = require('multer');
const { uploadToS3, deleteFromS3 } = require('../utils/s3Uploader');
const StaffBanner = require('../models/StaffBanner');
const { cache, clearCachePrefix } = require('../middleware/cache');
const bannerAdmin = require('../middleware/bannerAdmin');
const requireAreaForPublic = require('../middleware/requireAreaForPublic');

// Who may change these banners
const canManage = bannerAdmin(['Banners', 'Staff Banner', 'Staff Banners']);

// Configure Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper to upload to S3
const streamUpload = (fileBuffer) => uploadToS3(fileBuffer, 'staff-banners');

const normalizeAudience = (raw) => {
  if (!raw) return 'Staff';
  const l = String(raw).trim().toLowerCase();
  if (l === 'resident' || l === 'residents') return 'Resident';
  if (l === 'member' || l === 'members') return 'Member';
  return 'Staff';
};

// ---- Offer details page (Resident/Member banners) ----
const OFFER_THEMES = ['teal', 'green', 'blue', 'purple', 'orange', 'red', 'pink', 'amber'];

const str = (v, max) => String(v ?? '').trim().slice(0, max);

// Web, phone and mail links, or an in-app '/path'. Bare domains get https://
const cleanOfferLink = (raw) => {
  const link = str(raw, 500);
  if (!link) return '';
  if (/^(https?:\/\/|tel:|mailto:)/i.test(link)) return link;
  if (/^\/[\w\-/?=&.]*$/.test(link)) return link;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(link)) return `https://${link}`;
  return null;
};

const cleanList = (v, maxItems, maxLen) => {
  const arr = Array.isArray(v) ? v : String(v ?? '').split('\n');
  return arr.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
};

const numOrNull = (v, min, max) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
};

// `raw` arrives as a JSON string in multipart forms. Returns { offer } or { error }
const parseOffer = (raw) => {
  let o = raw;
  if (typeof raw === 'string') {
    try { o = JSON.parse(raw); } catch (e) { return { error: 'Offer details are not valid' }; }
  }
  if (!o || typeof o !== 'object') return { error: 'Offer details are not valid' };

  const ctaLink = cleanOfferLink(o.ctaLink);
  if (ctaLink === null) return { error: 'Button link must be a website, tel:, mailto: or /app-path link' };
  const mapLink = cleanOfferLink(o.mapLink);
  if (mapLink === null) return { error: 'Map link must be a website link' };

  const offer = {
    enabled: o.enabled === true || o.enabled === 'true',
    theme: OFFER_THEMES.includes(o.theme) ? o.theme : 'teal',
    tag: str(o.tag, 40),
    title: str(o.title, 90),
    description: str(o.description, 200),
    partnerName: str(o.partnerName, 60),
    partnerVerified: o.partnerVerified === undefined ? true : (o.partnerVerified === true || o.partnerVerified === 'true'),
    distance: str(o.distance, 20),
    rating: numOrNull(o.rating, 0, 5),
    ratingCount: numOrNull(o.ratingCount, 0, 10000000),
    points: cleanList(o.points, 10, 120),
    validText: str(o.validText, 60),
    address: str(o.address, 160),
    mapLink,
    phone: str(o.phone, 20).replace(/[^\d+\s-]/g, ''),
    terms: cleanList(o.terms, 10, 160),
    footerLabel: str(o.footerLabel, 40),
    ctaLabel: str(o.ctaLabel, 24),
    ctaLink,
    couponCode: str(o.couponCode, 30),
  };
  if (offer.ratingCount !== null) offer.ratingCount = Math.round(offer.ratingCount);
  if (offer.enabled && !offer.title) return { error: 'Offer details page needs a title' };
  return { offer };
};

// @route   GET /api/staff-banners
// @desc    Get banners filtered by target audience ('Staff' | 'Resident' | 'Member')
// @access  Public
router.get('/', requireAreaForPublic, cache(60), async (req, res) => {
  try {
    const target = normalizeAudience(req.query.target || req.query.audience);
    // Residents and Members share one banner pool
    const query = target === 'Staff'
      ? { $or: [{ audience: 'Staff' }, { audience: { $exists: false } }] }
      : { audience: { $in: ['Resident', 'Member'] } };
    if (req.query.all !== 'true') {
      query.isActive = true;
      query.$and = [
        {
          $or: [
            { expiresAt: null },
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } }
          ]
        }
      ];
    }

    const banners = await StaffBanner.find(query).sort({ order: 1, createdAt: -1 });
    res.json(banners);
  } catch (err) {
    console.error('Error fetching staff banners:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/staff-banners/:id
// @desc    One live banner, for the app's offer details page
// @access  Public
router.get('/:id', requireAreaForPublic, cache(60), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: 'Banner not found' });
    const banner = await StaffBanner.findOne({
      _id: req.params.id,
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
    });
    if (!banner) return res.status(404).json({ msg: 'Banner not found' });
    res.json(banner);
  } catch (err) {
    console.error('Error fetching staff banner:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/staff-banners/upload
// @desc    Upload a new banner for Staff, Resident, or Member
// @access  Public (admin)
router.post('/upload', canManage, upload.single('image'), async (req, res) => {
  try {
    const audience = normalizeAudience(req.body.audience || req.body.target);
    const style = req.body.style === 'card' ? 'card' : 'image';
    if (!req.file && style !== 'card') {
      return res.status(400).json({ msg: 'No image file provided' });
    }
    if (style === 'card' && !String(req.body.title || '').trim()) {
      return res.status(400).json({ msg: 'Card banners need a title' });
    }
    let offer;
    if (req.body.offer !== undefined && audience !== 'Staff') {
      const parsed = parseOffer(req.body.offer);
      if (parsed.error) return res.status(400).json({ msg: parsed.error });
      offer = parsed.offer;
    }

    const result = req.file ? await streamUpload(req.file.buffer) : { secure_url: '', public_id: '' };

    const newBanner = new StaffBanner({
      title: req.body.title || '',
      url: result.secure_url,
      public_id: result.public_id,
      audience: audience,
      style,
      tag: req.body.tag || '',
      subtitle: req.body.subtitle || '',
      ctaLabel: req.body.ctaLabel || '',
      icon: req.body.icon || '',
      isActive: req.body.isActive === undefined ? true : (req.body.isActive === 'true' || req.body.isActive === true),
      link: req.body.link || '',
      order: req.body.order ? Number(req.body.order) : 0,
      duration: req.body.duration !== undefined ? Math.max(1, Math.min(120, Number(req.body.duration) || 4)) : 4,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      ...(offer ? { offer } : {}),
    });

    const savedBanner = await newBanner.save();
    clearCachePrefix('/staff-banners');

    const io = req.app.get('io');
    if (io) {
      io.emit('staff_banner_changed', { action: 'create', banner: savedBanner });
      io.emit('resident_banner_changed', { action: 'create', banner: savedBanner });
      io.emit('member_banner_changed', { action: 'create', banner: savedBanner });
      io.emit('banner_changed', { action: 'create', banner: savedBanner });
    }

    res.json(savedBanner);
  } catch (err) {
    console.error('Error uploading staff banner:', err);
    res.status(500).send('Server Error during image upload');
  }
});

// @route   PUT /api/staff-banners/:id
// @desc    Update/modify a banner
// @access  Public (admin)
router.put('/:id', canManage, upload.single('image'), async (req, res) => {
  try {
    const banner = await StaffBanner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ msg: 'Banner not found' });
    }

    if (req.body.title !== undefined) {
      banner.title = req.body.title;
    }
    if (req.body.audience || req.body.target) {
      banner.audience = normalizeAudience(req.body.audience || req.body.target);
    }
    if (req.body.isActive !== undefined) {
      banner.isActive = req.body.isActive === 'true' || req.body.isActive === true;
    }
    if (req.body.link !== undefined) {
      banner.link = req.body.link;
    }
    if (req.body.style !== undefined) {
      banner.style = req.body.style === 'card' ? 'card' : 'image';
    }
    for (const f of ['tag', 'subtitle', 'ctaLabel', 'icon']) {
      if (req.body[f] !== undefined) banner[f] = req.body[f];
    }
    if (req.body.offer !== undefined) {
      const parsed = parseOffer(req.body.offer);
      if (parsed.error) return res.status(400).json({ msg: parsed.error });
      banner.offer = parsed.offer;
    }
    // Staff banners have no offer page
    if (banner.audience === 'Staff' && banner.offer?.enabled) banner.offer.enabled = false;
    // Card banners can drop their side image
    if (req.body.removeImage === 'true' && !req.file && banner.public_id) {
      try { await deleteFromS3(banner.public_id); } catch (e) { console.error('Error deleting banner image:', e); }
      banner.url = '';
      banner.public_id = '';
    }
    if (req.body.order !== undefined) {
      banner.order = Number(req.body.order);
    }
    if (req.body.duration !== undefined) {
      banner.duration = Math.max(1, Math.min(120, Number(req.body.duration) || 4));
    }
    if (req.body.expiresAt !== undefined) {
      banner.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    }

    // Replace image if new file is supplied
    if (req.file) {
      if (banner.public_id) {
        try {
          await deleteFromS3(banner.public_id);
        } catch (destroyErr) {
          console.error('Error deleting old S3 image:', destroyErr);
        }
      }
      const result = await streamUpload(req.file.buffer);
      banner.url = result.secure_url;
      banner.public_id = result.public_id;
    }

    const updatedBanner = await banner.save();
    clearCachePrefix('/staff-banners');

    const io = req.app.get('io');
    if (io) {
      io.emit('staff_banner_changed', { action: 'update', banner: updatedBanner });
      io.emit('resident_banner_changed', { action: 'update', banner: updatedBanner });
      io.emit('member_banner_changed', { action: 'update', banner: updatedBanner });
      io.emit('banner_changed', { action: 'update', banner: updatedBanner });
    }

    res.json(updatedBanner);
  } catch (err) {
    console.error('Error updating staff banner:', err);
    res.status(500).send('Server Error during banner update');
  }
});

// @route   DELETE /api/staff-banners/:id
// @desc    Delete a banner
// @access  Public (admin)
router.delete('/:id', canManage, async (req, res) => {
  try {
    const banner = await StaffBanner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ msg: 'Banner not found' });
    }

    if (banner.public_id) {
      try {
        await deleteFromS3(banner.public_id);
      } catch (destroyErr) {
        console.error('Error destroying S3 image:', destroyErr);
      }
    }

    await StaffBanner.findByIdAndDelete(req.params.id);
    clearCachePrefix('/staff-banners');

    const io = req.app.get('io');
    if (io) {
      io.emit('staff_banner_changed', { action: 'delete', id: req.params.id });
      io.emit('resident_banner_changed', { action: 'delete', id: req.params.id });
      io.emit('member_banner_changed', { action: 'delete', id: req.params.id });
      io.emit('banner_changed', { action: 'delete', id: req.params.id });
    }

    res.json({ msg: 'Banner deleted successfully' });
  } catch (err) {
    console.error('Error deleting staff banner:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
