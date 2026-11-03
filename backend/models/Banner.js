const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  public_id: {
    type: String,
    required: true,
  }
}, { timestamps: true });

BannerSchema.plugin(require('./plugins/areaScope'));

module.exports = mongoose.model('Banner', BannerSchema);
