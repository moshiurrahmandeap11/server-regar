const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Payment = require('../models/Payment');
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
    const { items, shippingAddress, subtotal, shipping, discount, total } = req.body;
    const rawPaymentMethod = String(req.body?.paymentMethod || '').toLowerCase();
    const paymentMethod = rawPaymentMethod === 'card' ? 'stripe' : rawPaymentMethod;

    if (!['stripe', 'manual'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Unsupported payment method' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }

    const orderNumber = generateOrderNumber();
    const order = new Order({
      user: req.user._id, orderNumber, items, shippingAddress,
      subtotal, shipping, discount, total, paymentMethod,
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
