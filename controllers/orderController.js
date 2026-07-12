const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const { fulfillPaidOrder } = require('../utils/orderFulfillment');

const generateOrderNumber = () => 'REG-' + Date.now().toString(36).toUpperCase();

exports.getOrders = async (req, res) => {
  try {
    const query = req.user.isAdmin ? {} : { user: req.user._id };
    const orders = await Order.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Attach payment info and raffle info for each order
    const orderIds = orders.map((o) => o._id);

    const [payments, tickets] = await Promise.all([
      Payment.find({ orderId: { $in: orderIds } }).sort({ createdAt: -1 }),
      Ticket.find({ order: { $in: orderIds } })
        .populate('raffle', 'name nameEn raffleNumber status')
        .select('order raffle ticketNumber'),
    ]);

    const paymentByOrder = new Map();
    payments.forEach((p) => {
      const key = String(p.orderId);
      if (!paymentByOrder.has(key)) paymentByOrder.set(key, p);
    });

    const ticketsByOrder = new Map();
    tickets.forEach((t) => {
      const key = String(t.order);
      if (!ticketsByOrder.has(key)) ticketsByOrder.set(key, []);
      ticketsByOrder.get(key).push(t);
    });

    const enriched = orders.map((order) => {
      const o = order.toObject();
      o.paymentInfo = paymentByOrder.get(String(o._id)) || null;
      o.ticketDocs = ticketsByOrder.get(String(o._id)) || [];
      return o;
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'firstName lastName email');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!req.user.isAdmin && order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.trackOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const email = req.query.email?.trim().toLowerCase();
    const phone = req.query.phone?.trim();

    if (!email && !phone) {
      return res.status(400).json({ message: 'Email or phone is required' });
    }

    const order = await Order.findOne({ orderNumber: orderNumber.trim().toUpperCase() })
      .populate('user', 'firstName lastName email phone');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const userEmail = order.user?.email?.toLowerCase();
    const userPhone = order.shippingAddress?.phone || order.user?.phone;
    const isEmailMatch = email && userEmail === email;
    const isPhoneMatch = phone && userPhone === phone;

    if (!isEmailMatch && !isPhoneMatch) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, shipping, discount } = req.body;
    const rawPaymentMethod = String(req.body?.paymentMethod || '').toLowerCase();
    const paymentMethod = rawPaymentMethod === 'card' ? 'stripe' : rawPaymentMethod;

    if (!['stripe', 'manual'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Unsupported payment method' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }

    // Validate items and recalculate totals server-side
    const productIds = items.map(item => item.product).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map(p => [String(p._id), p]));

    // Check if any product is linked to a drawn or closed raffle
    const raffleChecks = await Raffle.find({
      product: { $in: productIds },
      status: { $in: ['drawn', 'closed'] },
    }).select('product status');
    const blockedRaffleProductIds = new Set(raffleChecks.map(r => String(r.product)));

    let calculatedSubtotal = 0;
    for (const item of items) {
      const product = productMap.get(String(item.product));
      if (!product) {
        return res.status(400).json({ message: `Product not found: ${item.product}` });
      }
      if (!product.isActive) {
        return res.status(400).json({ message: `Product is not available: ${product.name}` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}. Available: ${product.stock}, requested: ${item.quantity}` });
      }
      if (blockedRaffleProductIds.has(String(item.product))) {
        return res.status(400).json({ message: `Raffle has ended for ${product.name}. You can no longer participate.` });
      }
      // Use server-side price, not client-provided price
      const itemPrice = product.price;
      const itemTotal = itemPrice * item.quantity;
      calculatedSubtotal += itemTotal;
      // Update item price to server-verified price
      item.price = itemPrice;
    }

    const calculatedShipping = calculatedSubtotal > 100 ? 0 : 9.90;
    const calculatedDiscount = Math.max(0, Number(discount) || 0);
    const calculatedTotal = Math.max(0, calculatedSubtotal + calculatedShipping - calculatedDiscount);

    const orderNumber = generateOrderNumber();
    const order = new Order({
      user: req.user._id, orderNumber, items, shippingAddress,
      subtotal: calculatedSubtotal,
      shipping: calculatedShipping,
      discount: calculatedDiscount,
      total: calculatedTotal,
      paymentMethod,
      paymentStatus: 'pending',
      status: 'awaiting_payment',
      tickets: [],
    });
    await order.save();

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, trackingNumber } = req.body;
    const allowedStatuses = ['awaiting_payment', 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
    const paidOnlyStatuses = ['paid', 'processing', 'shipped', 'delivered'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    const existing = await Order.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Order not found' });

    if (paidOnlyStatuses.includes(status) && existing.paymentStatus !== 'completed') {
      return res.status(400).json({
        message: 'Approve/complete the payment before moving this order to a paid or fulfillment status',
      });
    }

    const update = { status };
    if (trackingNumber) update.trackingNumber = trackingNumber;
    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const { paymentStatus, providerPaymentId } = req.body;
    const order = paymentStatus === 'completed'
      ? await fulfillPaidOrder(req.params.id, { providerPaymentId })
      : await Order.findByIdAndUpdate(req.params.id, {
        paymentStatus,
        providerPaymentId,
        status: paymentStatus === 'failed' ? 'cancelled' : 'awaiting_payment',
      }, { new: true });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
