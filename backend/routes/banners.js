const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const Banner = require('../models/Banner');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Configure Multer (memory storage for stream to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// @route   GET api/banners
// @desc    Get all banners
// @access  Public
router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/banners/upload
// @desc    Upload a new banner
// @access  Public (can add admin middleware later)
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No image file provided' });
    }

    // Upload to Cloudinary using a stream (most efficient for memory)
    const streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'anytime_help/banners',
            quality: 'auto',
            fetch_format: 'auto',
          },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const result = await streamUpload(req);

    // Save banner in database
    const newBanner = new Banner({
      url: result.secure_url,
      public_id: result.public_id,
    });

    const savedBanner = await newBanner.save();
    res.json(savedBanner);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error during image upload');
  }
});

// @route   DELETE api/banners/:id
// @desc    Delete a banner
// @access  Public (can add admin middleware later)
router.delete('/:id', async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ msg: 'Banner not found' });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(banner.public_id);

    // Delete from database
    await Banner.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Banner deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
