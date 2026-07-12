const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  raffle: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle', required: true },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  prize: { type: String, required: true },
  prizeEn: { type: String },
  prizeValue: { type: Number },
  quote: { type: String },
  quoteEn: { type: String },
  claimStatus: { type: String, enum: ['pending', 'claimed', 'shipped', 'delivered'], default: 'pending' },
  claimedAt: { type: Date },
  shippedAt: { type: Date },
  trackingNumber: { type: String },
  isSeeded: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Winner', winnerSchema);
