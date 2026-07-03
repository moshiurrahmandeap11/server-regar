const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  avatar: { type: String },
  address: {
    street: String,
    city: String,
    zip: String,
    country: String,
  },
  isAdmin: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  emailVerifyToken: { type: String },
  emailVerifyExpires: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  ageVerified: { type: Boolean, default: false },
  preferences: {
    newsletter: { type: Boolean, default: false },
    language: { type: String, default: 'fr' },
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
