const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const StaffBanner = require('../models/StaffBanner');
const { cache, clearCachePrefix } = require('../middleware/cache');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Configure Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper to stream upload to Cloudinary
const streamUpload = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'anytime_help/staff_banners',
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
  if (!raw) return 'Staff';
  const l = String(raw).trim().toLowerCase();
  if (l === 'resident' || l === 'residents') return 'Resident';
  if (l === 'member' || l === 'members') return 'Member';
  return 'Staff';
};

// @route   GET /api/staff-banners
// @desc    Get banners filtered by target audience ('Staff' | 'Resident' | 'Member')
// @access  Public
router.get('/', cache(60), async (req, res) => {
  try {
    const target = normalizeAudience(req.query.target || req.query.audience);
    const query = {
      $or: [
        { audience: target },
        ...(target === 'Staff' ? [{ audience: { $exists: false } }] : [])
      ]
    };
    if (req.query.all !== 'true') {
      query.isActive = true;
    }

    const banners = await StaffBanner.find(query).sort({ order: 1, createdAt: -1 });
    res.json(banners);
  } catch (err) {
    console.error('Error fetching staff banners:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/staff-banners/upload
// @desc    Upload a new banner for Staff, Resident, or Member
// @access  Public (admin)
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No image file provided' });
    }

    const result = await streamUpload(req.file.buffer);
    const audience = normalizeAudience(req.body.audience || req.body.target);

    const newBanner = new StaffBanner({
      title: req.body.title || '',
      url: result.secure_url,
      public_id: result.public_id,
      audience: audience,
      isActive: req.body.isActive === undefined ? true : (req.body.isActive === 'true' || req.body.isActive === true),
      link: req.body.link || '',
      order: req.body.order ? Number(req.body.order) : 0,
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
router.put('/:id', upload.single('image'), async (req, res) => {
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
    if (req.body.order !== undefined) {
      banner.order = Number(req.body.order);
    }

    // Replace image if new file is supplied
    if (req.file) {
      if (banner.public_id) {
        try {
          await cloudinary.uploader.destroy(banner.public_id);
        } catch (destroyErr) {
          console.error('Error destroying old Cloudinary image:', destroyErr);
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
router.delete('/:id', async (req, res) => {
  try {
    const banner = await StaffBanner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ msg: 'Banner not found' });
    }

    if (banner.public_id) {
      try {
        await cloudinary.uploader.destroy(banner.public_id);
      } catch (destroyErr) {
        console.error('Error destroying Cloudinary image:', destroyErr);
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
