const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  avatar: { type: String },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, required: true },
  commentEn: { type: String },
  isApproved: { type: Boolean, default: false },
  isSeeded: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
