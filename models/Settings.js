const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteName: { type: String, default: 'Regar' },
  siteNameEn: { type: String, default: 'Regar' },
  contactEmail: { type: String, default: 'contact@regar.ch' },
  contactPhone: { type: String, default: '+41 79 123 45 67' },
  currency: { type: String, default: 'CHF' },
  shippingCost: { type: Number, default: 9.90 },
  freeShippingThreshold: { type: Number, default: 100 },
  maintenanceMode: { type: Boolean, default: false },
  socialLinks: {
    instagram: String,
    facebook: String,
    twitter: String,
    tiktok: String,
  },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
