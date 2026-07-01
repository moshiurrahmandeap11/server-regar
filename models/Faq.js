const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  questionEn: { type: String },
  answer: { type: String, required: true },
  answerEn: { type: String },
  category: { type: String, default: 'general' },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Faq', faqSchema);
