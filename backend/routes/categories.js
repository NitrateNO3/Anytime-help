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
  {
    title: 'Electricity',
    title_hi: 'बिजली',
    title_hinglish: 'Bijli',
    subCategories: ['Power Outage', 'Sparking Wire', 'Meter Issue', 'Other'],
    subCategoriesDetails: [
      { en: 'Power Outage', hi: 'बिजली कटौती', hinglish: 'Bijli Chali Gayi' },
      { en: 'Sparking Wire', hi: 'तार में स्पार्किंग', hinglish: 'Taar me Sparking' },
      { en: 'Meter Issue', hi: 'मीटर समस्या', hinglish: 'Meter Problem' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  {
    title: 'Garbage',
    title_hi: 'कचरा',
    title_hinglish: 'Kachra',
    subCategories: ['Missed Pickup', 'Overflowing Bin', 'Debris Waste', 'Other'],
    subCategoriesDetails: [
      { en: 'Missed Pickup', hi: 'कचरा नहीं उठा', hinglish: 'Kachra Nahi Utha' },
      { en: 'Overflowing Bin', hi: 'डस्टबिन भर गया', hinglish: 'Dustbin Overfill' },
      { en: 'Debris Waste', hi: 'मलबा / कचरा', hinglish: 'Malba Waste' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  {
    title: 'Sweeping',
    title_hi: 'झाड़ू / सफाई',
    title_hinglish: 'Safai / Jhadu',
    subCategories: ['Road Not Swept', 'Leaves Accumulation', 'Other'],
    subCategoriesDetails: [
      { en: 'Road Not Swept', hi: 'सड़क पर झाड़ू नहीं लगी', hinglish: 'Sadak Safai Nahi Hui' },
      { en: 'Leaves Accumulation', hi: 'सूखे पत्ते जमा होना', hinglish: 'Patte Jama Hona' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  {
    title: 'Sewage cleaning',
    title_hi: 'सीवेज सफाई',
    title_hinglish: 'Sewage Safai',
    subCategories: ['Blocked Drain', 'Overflowing Manhole', 'Foul Odor', 'Other'],
    subCategoriesDetails: [
      { en: 'Blocked Drain', hi: 'नाली जाम होना', hinglish: 'Nali Jaam Hai' },
      { en: 'Overflowing Manhole', hi: 'मैनहोल ओवरफ्लो', hinglish: 'Manhole Overflow' },
      { en: 'Foul Odor', hi: 'बदबू आना', hinglish: 'Badboo / Foul Smell' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  {
    title: 'Rainwater drainage',
    title_hi: 'वर्षा जल निकासी',
    title_hinglish: 'Water Drainage',
    subCategories: ['Water Logging', 'Broken Drain Cover', 'Other'],
    subCategoriesDetails: [
      { en: 'Water Logging', hi: 'पानी भरना (जलभराव)', hinglish: 'Paani Bhara Hai' },
      { en: 'Broken Drain Cover', hi: 'नाली का ढक्कन टूटा', hinglish: 'Nali Cover Toota' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  {
    title: 'Tree cutting',
    title_hi: 'पेड़ काटना',
    title_hinglish: 'Ped Katna',
    subCategories: ['Fallen Tree', 'Overgrown Branches', 'Other'],
    subCategoriesDetails: [
      { en: 'Fallen Tree', hi: 'गिरा हुआ पेड़', hinglish: 'Ped Gir Gaya' },
      { en: 'Overgrown Branches', hi: 'बढ़ी हुई टहनियाँ', hinglish: 'Tahniyan Jyada Badh Gayi' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  {
    title: 'Street light',
    title_hi: 'स्ट्रीट लाइट',
    title_hinglish: 'Street Light',
    subCategories: ['Not Working', 'Flickering', 'Pole Damaged', 'Other'],
    subCategoriesDetails: [
      { en: 'Not Working', hi: 'काम नहीं कर रही', hinglish: 'Light Band Hai' },
      { en: 'Flickering', hi: 'लाइट टिमटिमा रही है', hinglish: 'Light Timtima Rahi Hai' },
      { en: 'Pole Damaged', hi: 'खंभा क्षतिग्रस्त', hinglish: 'Khambha Toota Hai' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  {
    title: 'Water service',
    title_hi: 'जल सेवा',
    title_hinglish: 'Paani Service',
    subCategories: ['No Water Supply', 'Contaminated Water', 'Pipeline Leakage', 'Other'],
    subCategoriesDetails: [
      { en: 'No Water Supply', hi: 'पानी की आपूर्ति नहीं', hinglish: 'Paani Nahi Aa Raha' },
      { en: 'Contaminated Water', hi: 'दूषित पानी', hinglish: 'Ganda Paani' },
      { en: 'Pipeline Leakage', hi: 'पाइपलाइन लीकेज', hinglish: 'Pipeline Leak Ho Rahi Hai' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  }
];

const categoryHiMap = {
  'tree trimming': 'पेड़ की कटाई',
  'tree cutting': 'पेड़ काटना',
  'rainwater drainage': 'वर्षा जल निकासी',
  'water drainage': 'जल निकासी',
  'water service': 'जल सेवा',
  'street light': 'स्ट्रीट लाइट',
  'garbage': 'कचरा',
  'sweeping': 'सफाई',
  'sewage cleaning': 'सीवेज सफाई',
  'electricity': 'बिजली',
  'security': 'सुरक्षा',
  'lift': 'लिफ्ट',
  'plumbing': 'प्लंबिंग',
  'park': 'पार्क',
  'others': 'अन्य',
  'other': 'अन्य'
};

const subCategoryHiMap = {
  'fallen tree': 'गिरा हुआ पेड़',
  'overgrown branches': 'बढ़ी हुई टहनियाँ',
  'branches': 'टहनियाँ',
  'pruning': 'छंटाई',
  'trimming': 'कटाई',
  'tree trimming': 'पेड़ की कटाई',
  'tree cutting': 'पेड़ काटना',
  'water logging': 'पानी भरना (जलभराव)',
  'broken drain cover': 'नाली का ढक्कन टूटा',
  'not working': 'काम नहीं कर रही',
  'flickering': 'लाइट टिमटिमा रही है',
  'pole damaged': 'खंभा क्षतिग्रस्त',
  'no water supply': 'पानी की आपूर्ति नहीं',
  'contaminated water': 'दूषित पानी',
  'pipeline leakage': 'पाइपलाइन लीकेज',
  'waste overflow': 'कचरा फैलना',
  'bin damaged': 'कूड़ेदान क्षतिग्रस्त',
  'door to door pending': 'डोर-टू-डोर पेंडिंग',
  'drain blockage': 'नाली जाम',
  'manhole open': 'मैनहोल खुला है',
  'other': 'अन्य',
  'others': 'अन्य'
};

// @route   GET /api/categories
// @desc    Get all categories (seeds default if empty and auto-fills translations)
router.get('/', async (req, res) => {
  try {
    let categories = await Category.find().sort({ order: 1, createdAt: 1 });
    
    // Seed default categories if DB is completely empty
    if (categories.length === 0) {
      await Category.insertMany(defaultCategories);
      categories = await Category.find().sort({ order: 1, createdAt: 1 });
    } else {
      // Auto-fill title_hi and subcategory translations for any category missing it
      for (let cat of categories) {
        let needsSave = false;
        const normalized = (cat.title || '').trim().toLowerCase();
        if ((!cat.title_hi || !cat.title_hi.trim()) && categoryHiMap[normalized]) {
          cat.title_hi = categoryHiMap[normalized];
          needsSave = true;
        }
        if (Array.isArray(cat.subCategories) && cat.subCategories.length > 0) {
          if (!cat.subCategoriesDetails || cat.subCategoriesDetails.length === 0) {
            cat.subCategoriesDetails = cat.subCategories.map(sub => ({
              en: sub,
              hi: subCategoryHiMap[sub.trim().toLowerCase()] || sub,
              hinglish: sub
            }));
            needsSave = true;
          } else {
            for (let detail of cat.subCategoriesDetails) {
              if (!detail.hi && detail.en && subCategoryHiMap[detail.en.trim().toLowerCase()]) {
                detail.hi = subCategoryHiMap[detail.en.trim().toLowerCase()];
                needsSave = true;
              }
            }
          }
        }
        if (needsSave) {
          await Category.updateOne({ _id: cat._id }, { 
            $set: { 
              title_hi: cat.title_hi,
              subCategoriesDetails: cat.subCategoriesDetails
            } 
          });
        }
      }
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
  let { title, title_hi, title_hinglish, subCategories, subCategoriesDetails } = req.body;
  
  if (typeof subCategories === 'string') {
    try {
      subCategories = JSON.parse(subCategories);
    } catch(e) {
      subCategories = [];
    }
  }

  if (typeof subCategoriesDetails === 'string') {
    try {
      subCategoriesDetails = JSON.parse(subCategoriesDetails);
    } catch(e) {
      subCategoriesDetails = [];
    }
  }

  if (!title_hi && title) {
    const normalized = title.trim().toLowerCase();
    if (categoryHiMap[normalized]) {
      title_hi = categoryHiMap[normalized];
    }
  }

  // Auto-sync subCategories string array if subCategoriesDetails was provided
  if (Array.isArray(subCategoriesDetails) && subCategoriesDetails.length > 0) {
    subCategories = subCategoriesDetails.map(item => (typeof item === 'object' ? item.en || item.title || '' : item)).filter(Boolean);
  } else if (Array.isArray(subCategories) && (!subCategoriesDetails || subCategoriesDetails.length === 0)) {
    subCategoriesDetails = subCategories.map(s => {
      const name = typeof s === 'string' ? s : (s.en || s.title || '');
      return { 
        en: name, 
        hi: subCategoryHiMap[name.trim().toLowerCase()] || name, 
        hinglish: name 
      };
    });
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
      title_hi: title_hi || '',
      title_hinglish: title_hinglish || '',
      activeLanguage: req.body.activeLanguage || 'en',
      image: imageUrl,
      public_id: publicId,
      subCategories: subCategories || [],
      subCategoriesDetails: subCategoriesDetails || []
    });

    await category.save();
    if (req.app.get('io')) {
      req.app.get('io').emit('categories_updated');
    }
    res.json(category);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/categories/:id
// @desc    Update a category
router.put('/:id', [auth, upload.single('image')], async (req, res) => {
  let { title, title_hi, title_hinglish, subCategories, subCategoriesDetails, activeLanguage } = req.body;
  
  if (typeof subCategories === 'string') {
    try {
      subCategories = JSON.parse(subCategories);
    } catch(e) {
      subCategories = [];
    }
  }

  if (typeof subCategoriesDetails === 'string') {
    try {
      subCategoriesDetails = JSON.parse(subCategoriesDetails);
    } catch(e) {
      subCategoriesDetails = [];
    }
  }

  try {
    let category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ msg: 'Category not found' });

    if (title !== undefined) category.title = title;
    if (title_hi !== undefined && title_hi.trim()) {
      category.title_hi = title_hi;
    } else if (title && categoryHiMap[title.trim().toLowerCase()]) {
      category.title_hi = categoryHiMap[title.trim().toLowerCase()];
    }
    if (title_hinglish !== undefined) category.title_hinglish = title_hinglish;
    if (subCategoriesDetails !== undefined) {
      category.subCategoriesDetails = subCategoriesDetails;
    }

    if (subCategories !== undefined && Array.isArray(subCategories) && subCategories.length > 0) {
      category.subCategories = subCategories;
    } else if (subCategoriesDetails !== undefined) {
      category.subCategories = subCategoriesDetails.map(item => (typeof item === 'object' ? item.en || item.title || '' : item)).filter(Boolean);
    }

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
    if (req.app.get('io')) {
      req.app.get('io').emit('categories_updated');
    }
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
    if (req.app.get('io')) {
      req.app.get('io').emit('categories_updated');
    }
    res.json({ msg: 'Category removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/categories/reorder
// @desc    Reorder categories in bulk
router.post('/reorder', auth, async (req, res) => {
  const { orderedIds } = req.body;
  if (!orderedIds || !Array.isArray(orderedIds)) {
    return res.status(400).json({ msg: 'orderedIds must be an array' });
  }

  try {
    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index } }
      }
    }));

    if (bulkOps.length > 0) {
      await Category.bulkWrite(bulkOps);
    }
    if (req.app.get('io')) {
      req.app.get('io').emit('categories_updated');
    }

    res.json({ msg: 'Categories reordered successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
