const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AppSetting = require('../models/AppSetting');

// "Why residents love Anytime Help" section on the resident/member home
// screen. Universal (same in every area), edited only by the platform Super
// Admin. Stored as one AppSetting document.
const KEY = 'home_perks';
const MAX_PERKS = 6;

// Colour themes and icons the admin can pick from (the app knows the same keys)
const THEMES = ['green', 'yellow', 'pink', 'blue', 'purple', 'orange', 'teal', 'red'];
const ICONS = [
  'flask-outline', 'time-outline', 'pricetag-outline', 'medkit-outline', 'heart-outline',
  'shield-checkmark-outline', 'gift-outline', 'star-outline', 'people-outline', 'home-outline',
  'call-outline', 'cart-outline', 'construct-outline', 'flash-outline', 'leaf-outline', 'sparkles-outline',
];

// What the app showed before this was editable; used until the Super Admin saves
const DEFAULT = {
  enabled: true,
  title: 'Why residents love Anytime Help',
  perks: [
    { big: '15% off', sub: 'Lab tests, scans and health check-ups', icon: 'flask-outline', theme: 'green' },
    { big: 'Priority', sub: 'OPD slots kept for residents', icon: 'time-outline', theme: 'yellow' },
    { big: '40+ offers', sub: 'From verified shops near your society', icon: 'pricetag-outline', theme: 'pink' },
  ],
};

let cache = null;

const load = async () => {
  if (cache) return cache;
  const doc = await AppSetting.findOne({ key: KEY }).lean();
  cache = doc?.value ? { ...DEFAULT, ...doc.value } : DEFAULT;
  return cache;
};

const clean = (body = {}) => {
  const perks = (Array.isArray(body.perks) ? body.perks : [])
    .map((p) => ({
      big: String(p?.big || '').trim().slice(0, 30),
      sub: String(p?.sub || '').trim().slice(0, 90),
      icon: ICONS.includes(p?.icon) ? p.icon : ICONS[0],
      theme: THEMES.includes(p?.theme) ? p.theme : THEMES[0],
    }))
    .filter((p) => p.big || p.sub)
    .slice(0, MAX_PERKS);
  return {
    enabled: body.enabled !== false && body.enabled !== 'false',
    title: String(body.title || '').trim().slice(0, 60) || DEFAULT.title,
    perks,
  };
};

// @route   GET /api/home-perks
// @desc    The section's title, on/off and cards (plus the allowed icons/themes)
// @access  Public
router.get('/', async (req, res) => {
  try {
    res.json({ ...(await load()), icons: ICONS, themes: THEMES, maxPerks: MAX_PERKS });
  } catch (err) {
    console.error('Error loading home perks:', err);
    res.json({ ...DEFAULT, icons: ICONS, themes: THEMES, maxPerks: MAX_PERKS });
  }
});

// @route   PUT /api/home-perks
// @desc    Replace the section (title, enabled, perks[])
// @access  Private (platform Super Admin only)
router.put('/', auth, async (req, res) => {
  try {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ msg: 'Only the Super Admin can change this section' });
    }
    const value = clean(req.body);
    await AppSetting.findOneAndUpdate(
      { key: KEY },
      { value, updated_by: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    cache = value;

    // Every area shows the same section: notify all connected apps
    const io = req.app.get('io');
    if (io?.sockets) io.sockets.emit('home_perks_changed');

    res.json(value);
  } catch (err) {
    console.error('Error saving home perks:', err);
    res.status(500).json({ msg: 'Server error saving section' });
  }
});

module.exports = router;
