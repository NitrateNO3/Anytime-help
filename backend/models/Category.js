const mongoose = require('mongoose');

const subCategoryItemSchema = new mongoose.Schema({
  en: { type: String, required: true },
  hi: { type: String, default: '' },
  hinglish: { type: String, default: '' },
}, { _id: false });

const categorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true,
  },
  title_hi: {
    type: String,
    default: '',
  },
  title_hinglish: {
    type: String,
    default: '',
  },
  image: {
    type: String,
    required: false,
  },
  public_id: {
    type: String,
    required: false,
  },
  subCategories: [{
    type: String,
  }],
  subCategoriesDetails: [subCategoryItemSchema],
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
