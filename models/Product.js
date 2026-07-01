const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameEn: { type: String },
  description: { type: String, required: true },
  descriptionEn: { type: String },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  images: [{ type: String }],
  colors: [{ name: String, hex: String, image: String }],
  sizes: [{ type: String }],
  stock: { type: Number, default: 0 },
  maxTickets: { type: Number, default: 100 },
  soldTickets: { type: Number, default: 0 },
  category: { type: String, default: 'caps' },
  isActive: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  raffleEndDate: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
