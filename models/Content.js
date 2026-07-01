const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  valueFr: { type: String },
  valueEn: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Content', contentSchema);
