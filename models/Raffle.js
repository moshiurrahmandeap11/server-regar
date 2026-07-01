const mongoose = require('mongoose');

const raffleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameEn: { type: String },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  prizes: [{
    name: String,
    nameEn: String,
    image: String,
    value: Number,
  }],
  status: { type: String, enum: ['draft', 'active', 'closed', 'drawn'], default: 'draft' },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winningTicket: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Raffle', raffleSchema);
