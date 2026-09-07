const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true,
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
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
