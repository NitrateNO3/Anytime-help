const mongoose = require('mongoose');
require('dotenv').config();
const Category = require('./models/Category');

const translations = {
  'Electricity': {
    title_hi: 'बिजली',
    title_hinglish: 'Bijli',
    details: [
      { en: 'Power Outage', hi: 'बिजली कटौती', hinglish: 'Bijli Chali Gayi' },
      { en: 'Sparking Wire', hi: 'तार में स्पार्किंग', hinglish: 'Taar me Sparking' },
      { en: 'Meter Issue', hi: 'मीटर समस्या', hinglish: 'Meter Problem' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  'Garbage': {
    title_hi: 'कचरा',
    title_hinglish: 'Kachra',
    details: [
      { en: 'Missed Pickup', hi: 'कचरा नहीं उठा', hinglish: 'Kachra Nahi Utha' },
      { en: 'Overflowing Bin', hi: 'डस्टबिन भर गया', hinglish: 'Dustbin Overfill' },
      { en: 'Debris Waste', hi: 'मलबा / कचरा', hinglish: 'Malba Waste' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  'Sweeping': {
    title_hi: 'झाड़ू / सफाई',
    title_hinglish: 'Safai / Jhadu',
    details: [
      { en: 'Road Not Swept', hi: 'सड़क पर झाड़ू नहीं लगी', hinglish: 'Sadak Safai Nahi Hui' },
      { en: 'Leaves Accumulation', hi: 'सूखे पत्ते जमा होना', hinglish: 'Patte Jama Hona' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  'Sewage cleaning': {
    title_hi: 'सीवेज सफाई',
    title_hinglish: 'Sewage Safai',
    details: [
      { en: 'Blocked Drain', hi: 'नाली जाम होना', hinglish: 'Nali Jaam Hai' },
      { en: 'Overflowing Manhole', hi: 'मैनहोल ओवरफ्लो', hinglish: 'Manhole Overflow' },
      { en: 'Foul Odor', hi: 'बदबू आना', hinglish: 'Badboo / Foul Smell' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  'Rainwater drainage': {
    title_hi: 'वर्षा जल निकासी',
    title_hinglish: 'Water Drainage',
    details: [
      { en: 'Water Logging', hi: 'पानी भरना (जलभराव)', hinglish: 'Paani Bhara Hai' },
      { en: 'Broken Drain Cover', hi: 'नाली का ढक्कन टूटा', hinglish: 'Nali Cover Toota' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  'Tree cutting': {
    title_hi: 'पेड़ काटना',
    title_hinglish: 'Ped Katna',
    details: [
      { en: 'Fallen Tree', hi: 'गिरा हुआ पेड़', hinglish: 'Ped Gir Gaya' },
      { en: 'Overgrown Branches', hi: 'बढ़ी हुई टहनियाँ', hinglish: 'Tahniyan Jyada Badh Gayi' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  'Street light': {
    title_hi: 'स्ट्रीट लाइट',
    title_hinglish: 'Street Light',
    details: [
      { en: 'Not Working', hi: 'काम नहीं कर रही', hinglish: 'Light Band Hai' },
      { en: 'Flickering', hi: 'लाइट टिमटिमा रही है', hinglish: 'Light Timtima Rahi Hai' },
      { en: 'Pole Damaged', hi: 'खंभा क्षतिग्रस्त', hinglish: 'Khambha Toota Hai' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  },
  'Water service': {
    title_hi: 'जल सेवा',
    title_hinglish: 'Paani Service',
    details: [
      { en: 'No Water Supply', hi: 'पानी की आपूर्ति नहीं', hinglish: 'Paani Nahi Aa Raha' },
      { en: 'Contaminated Water', hi: 'दूषित पानी', hinglish: 'Ganda Paani' },
      { en: 'Pipeline Leakage', hi: 'पाइपलाइन लीकेज', hinglish: 'Pipeline Leak Ho Rahi Hai' },
      { en: 'Other', hi: 'अन्य', hinglish: 'Dusra Issue' }
    ]
  }
};

const runMigration = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/anytime_help';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const categories = await Category.find();
    console.log(`Found ${categories.length} categories.`);

    for (const cat of categories) {
      const trans = translations[cat.title];
      let updated = false;

      if (trans) {
        if (!cat.title_hi || cat.title_hi === '') {
          cat.title_hi = trans.title_hi;
          updated = true;
        }
        if (!cat.title_hinglish || cat.title_hinglish === '') {
          cat.title_hinglish = trans.title_hinglish;
          updated = true;
        }
        if (!cat.subCategoriesDetails || cat.subCategoriesDetails.length === 0) {
          cat.subCategoriesDetails = trans.details;
          updated = true;
        }
      } else {
        if (!cat.subCategoriesDetails || cat.subCategoriesDetails.length === 0) {
          cat.subCategoriesDetails = (cat.subCategories || []).map(s => ({ en: s, hi: '', hinglish: '' }));
          updated = true;
        }
      }

      if (updated) {
        await cat.save();
        console.log(`Updated category: ${cat.title}`);
      }
    }

    console.log('Category migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
};

runMigration();
