const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const Category = require('../models/Category');
const auth = require('../middleware/auth');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Configure Multer (memory storage for stream to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ storage });

const defaultCategories = [
  { title: 'Electricity', subCategories: ['Power Outage', 'Sparking Wire', 'Meter Issue', 'Other'] },
  { title: 'Garbage', subCategories: ['Missed Pickup', 'Overflowing Bin', 'Debris Waste', 'Other'] },
  { title: 'Sweeping', subCategories: ['Road Not Swept', 'Leaves Accumulation', 'Other'] },
  { title: 'Sewage cleaning', subCategories: ['Blocked Drain', 'Overflowing Manhole', 'Foul Odor', 'Other'] },
  { title: 'Rainwater drainage', subCategories: ['Water Logging', 'Broken Drain Cover', 'Other'] },
  { title: 'Tree cutting', subCategories: ['Fallen Tree', 'Overgrown Branches', 'Other'] },
  { title: 'Street light', subCategories: ['Not Working', 'Flickering', 'Pole Damaged', 'Other'] },
  { title: 'Water service', subCategories: ['No Water Supply', 'Contaminated Water', 'Pipeline Leakage', 'Other'] }
];

// @route   GET /api/categories
// @desc    Get all categories (seeds default if empty)
router.get('/', async (req, res) => {
  try {
    let categories = await Category.find().sort({ createdAt: -1 });
    
    // Seed default categories if DB is completely empty
    if (categories.length === 0) {
      await Category.insertMany(defaultCategories);
      categories = await Category.find().sort({ createdAt: -1 });
    }
    
    res.json(categories);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Helper for Cloudinary upload
const streamUpload = (req) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'anytime_help/categories',
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

// @route   POST /api/categories
// @desc    Create a category
router.post('/', [auth, upload.single('image')], async (req, res) => {
  let { title, subCategories } = req.body;
  
  if (typeof subCategories === 'string') {
    try {
      subCategories = JSON.parse(subCategories);
    } catch(e) {
      subCategories = [];
    }
  }

  try {
    let imageUrl = '';
    let publicId = '';

    if (req.file) {
      const result = await streamUpload(req);
      imageUrl = result.secure_url;
      publicId = result.public_id;
    }

    let category = new Category({
      title,
      image: imageUrl,
      public_id: publicId,
      subCategories: subCategories || []
    });

    await category.save();
    res.json(category);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/categories/:id
// @desc    Update a category
router.put('/:id', [auth, upload.single('image')], async (req, res) => {
  let { title, subCategories } = req.body;
  
  if (typeof subCategories === 'string') {
    try {
      subCategories = JSON.parse(subCategories);
    } catch(e) {
      subCategories = [];
    }
  }

  try {
    let category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ msg: 'Category not found' });

    if (title) category.title = title;
    if (subCategories) category.subCategories = subCategories;

    if (req.body.removeImage === 'true') {
      if (category.public_id) {
        await cloudinary.uploader.destroy(category.public_id);
      }
      category.image = '';
      category.public_id = '';
    } else if (req.file) {
      // Delete old image if it exists
      if (category.public_id) {
        await cloudinary.uploader.destroy(category.public_id);
      }
      
      const result = await streamUpload(req);
      category.image = result.secure_url;
      category.public_id = result.public_id;
    }

    await category.save();
    res.json(category);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/categories/:id
// @desc    Delete a category
router.delete('/:id', auth, async (req, res) => {
  try {
    let category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ msg: 'Category not found' });

    if (category.public_id) {
      await cloudinary.uploader.destroy(category.public_id);
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Category removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
