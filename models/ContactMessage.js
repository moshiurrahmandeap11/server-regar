const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['new', 'resolved'], default: 'new' },
}, { timestamps: true });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
