const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const jwt = require('jsonwebtoken');
const BottomBanner = require('../models/BottomBanner');
const User = require('../models/User');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Configure Multer (memory storage for buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage });

const streamUpload = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'anytime_help/bottom_banners',
        quality: 'auto',
        fetch_format: 'auto',
        width: 1200,
        crop: 'limit',
      },
      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

const normalizeAudience = (raw) => {
  if (!raw) return 'All';
  const l = String(raw).trim().toLowerCase();
  if (l === 'resident' || l === 'residents') return 'Resident';
  if (l === 'member' || l === 'members') return 'Member';
  if (l === 'staff') return 'Staff';
  return 'All';
};

const notifySocket = (req) => {
  try {
    const io = req.app.get('io');
    if (io) {
      io.emit('bottom_banners_changed');
    }
  } catch (e) {
    console.error('Socket emit error:', e);
  }
};

// Optional auth helper: populates req.user if valid token provided, but doesn't hard-fail
const optionalAuth = async (req, res, next) => {
  const token = req.header('x-auth-token') || req.header('authorization')?.replace('Bearer ', '');
  if (token && process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.user?.id) {
        const user = await User.findById(decoded.user.id);
        if (user) req.user = user;
      }
    } catch (e) {
      // lenient - proceed as public/admin client
    }
  }
  next();
};

// @route   GET /api/bottom-banners
// @desc    Get bottom banners (by audience, active only for apps, or ?all=true for admin)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const rawTarget = req.query.target || req.query.audience;
    const target = normalizeAudience(rawTarget);
    const isAllMode = req.query.all === 'true';

    const query = {};
    if (!isAllMode) {
      query.isActive = true;
    }

    if (rawTarget && target !== 'All') {
      query.targetAudience = { $in: [target, 'All'] };
    }

    const banners = await BottomBanner.find(query).sort({ order: 1, createdAt: -1 });
    res.json(banners);
  } catch (err) {
    console.error('Error fetching bottom banners:', err.message);
    res.status(500).json({ msg: 'Server error fetching bottom banners' });
  }
});

// @route   GET /api/bottom-banners/all
// @desc    Get all bottom banners for admin management
// @access  Public / Admin
router.get('/all', optionalAuth, async (req, res) => {
  try {
    const rawTarget = req.query.target || req.query.audience;
    const query = {};
    if (rawTarget && rawTarget !== 'All') {
      query.targetAudience = normalizeAudience(rawTarget);
    }
    const banners = await BottomBanner.find(query).sort({ order: 1, createdAt: -1 });
    res.json(banners);
  } catch (err) {
    console.error('Error fetching all bottom banners:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/bottom-banners/upload
// @route   POST /api/bottom-banners
// @desc    Upload new bottom banner (Multer file, Base64 image, or image URL)
// @access  Admin
const handleCreateBanner = async (req, res) => {
  try {
    let url = '';
    let public_id = '';
    const imgPayload = req.body.image || req.body.url;

    if (req.file) {
      const result = await streamUpload(req.file.buffer);
      url = result.secure_url;
      public_id = result.public_id;
    } else if (imgPayload && imgPayload.startsWith('data:image')) {
      const result = await cloudinary.uploader.upload(imgPayload, {
        folder: 'anytime_help/bottom_banners',
        transformation: [{ quality: 'auto', fetch_format: 'auto', width: 1200, crop: 'limit' }]
      });
      url = result.secure_url;
      public_id = result.public_id;
    } else if (imgPayload && (imgPayload.startsWith('http://') || imgPayload.startsWith('https://'))) {
      url = imgPayload;
    } else {
      return res.status(400).json({ msg: 'Please provide a banner image file or valid image URL' });
    }

    const { title, link, order, targetAudience, audience, duration, isActive } = req.body;
    const finalAudience = normalizeAudience(targetAudience || audience || 'All');

    const newBanner = new BottomBanner({
      title: (title || '').trim(),
      url,
      public_id,
      link: (link || '').trim(),
      order: order !== undefined && order !== null ? Number(order) : 0,
      targetAudience: finalAudience,
      duration: duration ? Math.max(1, Math.min(60, Number(duration))) : 4,
      isActive: isActive === undefined ? true : (isActive === 'true' || isActive === true),
    });

    const saved = await newBanner.save();
    notifySocket(req);

    res.status(201).json(saved);
  } catch (err) {
    console.error('Error creating bottom banner:', err);
    res.status(500).json({ msg: 'Server error creating bottom banner' });
  }
};

router.post('/upload', optionalAuth, upload.single('image'), handleCreateBanner);
router.post('/', optionalAuth, upload.single('image'), handleCreateBanner);

// @route   PUT /api/bottom-banners/:id
// @desc    Update bottom banner
// @access  Admin
router.put('/:id', optionalAuth, upload.single('image'), async (req, res) => {
  try {
    const banner = await BottomBanner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ msg: 'Bottom banner not found' });
    }

    const imgPayload = req.body.image || req.body.url;

    if (req.file) {
      if (banner.public_id) {
        try {
          await cloudinary.uploader.destroy(banner.public_id);
        } catch (e) {
          console.log('Error destroying old image:', e);
        }
      }
      const result = await streamUpload(req.file.buffer);
      banner.url = result.secure_url;
      banner.public_id = result.public_id;
    } else if (imgPayload && imgPayload.startsWith('data:image')) {
      if (banner.public_id) {
        try {
          await cloudinary.uploader.destroy(banner.public_id);
        } catch (e) {
          console.log('Error destroying old image:', e);
        }
      }
      const result = await cloudinary.uploader.upload(imgPayload, {
        folder: 'anytime_help/bottom_banners',
        transformation: [{ quality: 'auto', fetch_format: 'auto', width: 1200, crop: 'limit' }]
      });
      banner.url = result.secure_url;
      banner.public_id = result.public_id;
    } else if (imgPayload && (imgPayload.startsWith('http://') || imgPayload.startsWith('https://'))) {
      banner.url = imgPayload;
    }

    if (req.body.title !== undefined) banner.title = req.body.title.trim();
    if (req.body.link !== undefined) banner.link = req.body.link.trim();
    if (req.body.targetAudience !== undefined || req.body.audience !== undefined) {
      banner.targetAudience = normalizeAudience(req.body.targetAudience || req.body.audience);
    }
    if (req.body.order !== undefined) banner.order = Number(req.body.order);
    if (req.body.duration !== undefined) banner.duration = Math.max(1, Math.min(60, Number(req.body.duration)));
    if (req.body.isActive !== undefined) banner.isActive = req.body.isActive === 'true' || req.body.isActive === true;

    const updated = await banner.save();
    notifySocket(req);

    res.json(updated);
  } catch (err) {
    console.error('Error updating bottom banner:', err);
    res.status(500).json({ msg: 'Server error updating bottom banner' });
  }
});

// @route   PATCH /api/bottom-banners/:id/toggle
// @desc    Toggle active state of bottom banner
// @access  Admin
router.patch('/:id/toggle', optionalAuth, async (req, res) => {
  try {
    const banner = await BottomBanner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ msg: 'Bottom banner not found' });
    }

    banner.isActive = !banner.isActive;
    await banner.save();
    notifySocket(req);

    res.json({ success: true, isActive: banner.isActive, banner });
  } catch (err) {
    console.error('Error toggling bottom banner:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE /api/bottom-banners/:id
// @desc    Delete bottom banner
// @access  Admin
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const banner = await BottomBanner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ msg: 'Bottom banner not found' });
    }

    if (banner.public_id) {
      try {
        await cloudinary.uploader.destroy(banner.public_id);
      } catch (e) {
        console.error('Cloudinary destroy error:', e);
      }
    }

    await BottomBanner.findByIdAndDelete(banner._id);
    notifySocket(req);

    res.json({ success: true, msg: 'Bottom banner deleted' });
  } catch (err) {
    console.error('Error deleting bottom banner:', err);
    res.status(500).json({ msg: 'Server error deleting banner' });
  }
});

module.exports = router;
