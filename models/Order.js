const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderNumber: { type: String, required: true, unique: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    nameEn: String,
    price: Number,
    quantity: Number,
    color: String,
    size: String,
    image: String,
    raffle: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle' },
    raffleNumber: Number,
    raffleName: String,
    raffleNameEn: String,
  }],
  shippingAddress: {
    firstName: String,
    lastName: String,
    street: String,
    city: String,
    zip: String,
    country: String,
    phone: String,
  },
  subtotal: { type: Number, required: true },
  shipping: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  status: { type: String, enum: ['awaiting_payment', 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'awaiting_payment' },
  paymentMethod: { type: String, enum: ['stripe', 'manual', 'card'], default: 'stripe' },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  providerPaymentId: { type: String },
  trackingNumber: { type: String },
  tickets: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
