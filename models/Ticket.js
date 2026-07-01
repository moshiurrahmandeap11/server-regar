const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketNumber: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  raffle: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle' },
  isWinner: { type: Boolean, default: false },
  prize: { type: String },
  drawDate: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
