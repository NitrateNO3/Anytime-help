const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    // unique per area, see compound index below
  },
});

departmentSchema.plugin(require('./plugins/areaScope'));
departmentSchema.index({ area: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
