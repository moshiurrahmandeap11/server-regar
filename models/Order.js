const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderNumber: { type: String, required: true, unique: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    price: Number,
    quantity: Number,
    color: String,
    size: String,
    image: String,
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
  status: { type: String, enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  paymentMethod: { type: String, enum: ['card', 'paypal'], default: 'card' },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  paypalOrderId: { type: String },
  trackingNumber: { type: String },
  tickets: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
