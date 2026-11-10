const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AppSetting = require('../models/AppSetting');

const MAINTENANCE_KEY = 'maintenance';
const OFF = { enabled: false, message: '', ends_at: null };

// Cached in memory: /api/config is hit on every app open
let maintenanceCache = null;

const getMaintenance = async () => {
  if (maintenanceCache) return maintenanceCache;
  try {
    const doc = await AppSetting.findOne({ key: MAINTENANCE_KEY }).lean();
    maintenanceCache = { ...OFF, ...(doc?.value || {}) };
  } catch (err) {
    console.error('Error loading maintenance setting:', err);
    return OFF; // don't cache a failed read
  }
  return maintenanceCache;
};

// @route   GET api/config
// @desc    Get app configuration: minimum version for force update + maintenance mode
// @access  Public
router.get('/', async (req, res) => {
  res.json({
    min_version: "1.0.2",
    latest_version: "1.0.2",
    play_store_url: "https://play.google.com/store/apps/details?id=com.aman_mirza.app",
    maintenance: await getMaintenance()
  });
});

// @route   PUT api/config/maintenance
// @desc    Turn maintenance mode on/off for the whole app (all areas)
// @access  Private (platform Super Admin only)
router.put('/maintenance', auth, async (req, res) => {
  try {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ msg: 'Only the Super Admin can change maintenance mode' });
    }

    const { enabled, message, ends_at } = req.body || {};
    let endsAt = null;
    if (ends_at) {
      const d = new Date(ends_at);
      if (isNaN(d.getTime())) return res.status(400).json({ msg: 'Invalid end time' });
      endsAt = d.toISOString();
    }

    const value = {
      enabled: enabled === true || enabled === 'true',
      message: String(message || '').trim().slice(0, 500),
      ends_at: endsAt,
      updated_at: new Date().toISOString(),
    };

    await AppSetting.findOneAndUpdate(
      { key: MAINTENANCE_KEY },
      { value, updated_by: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    maintenanceCache = { ...OFF, ...value };

    // Broadcast to every connected app in every area (bypasses the area-scoped emit)
    const io = req.app.get('io');
    if (io?.sockets) io.sockets.emit('maintenance_updated', maintenanceCache);

    res.json({ success: true, maintenance: maintenanceCache });
  } catch (err) {
    console.error('Error updating maintenance mode:', err);
    res.status(500).json({ msg: 'Server error updating maintenance mode' });
  }
});

module.exports = router;
