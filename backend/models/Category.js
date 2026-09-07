const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true,
  },
  icon: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  bgColor: {
    type: String,
    required: true,
  },
  subCategories: [{
    type: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
