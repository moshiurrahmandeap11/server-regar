const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'CHF' },
  method: { type: String, enum: ['stripe', 'manual'], required: true },
  status: { type: String, enum: ['pending','approved','declined','paid'], default: 'pending' },
  providerPaymentId: { type: String },
  proofUrl: { type: String },
  txId: { type: String },
  adminNote: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
