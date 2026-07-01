const Order = require('../models/Order');
const Product = require('../models/Product');
const Ticket = require('../models/Ticket');

const generateOrderNumber = () => 'REG-' + Date.now().toString(36).toUpperCase();
const generateTicketNumber = () => 'TKT-' + Math.random().toString(36).substr(2, 9).toUpperCase();

exports.getOrders = async (req, res) => {
  try {
    const query = req.user.isAdmin ? {} : { user: req.user._id };
    const orders = await Order.find(query).populate('user', 'firstName lastName email').sort({ createdAt: -1 });
    res.json(orders);
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

exports.createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, subtotal, shipping, discount, total, paymentMethod } = req.body;
    const orderNumber = generateOrderNumber();
    const tickets = [];

    for (const item of items) {
      const qty = item.quantity || 1;
      for (let i = 0; i < qty; i++) {
        tickets.push(generateTicketNumber());
      }
      await Product.findByIdAndUpdate(item.product, { $inc: { soldTickets: qty, stock: -qty } });
    }

    const order = new Order({
      user: req.user._id, orderNumber, items, shippingAddress,
      subtotal, shipping, discount, total, paymentMethod, tickets,
    });
    await order.save();

    for (const tkt of tickets) {
      await Ticket.create({ ticketNumber: tkt, user: req.user._id, order: order._id });
    }

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
    const { paymentStatus, paypalOrderId } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, {
      paymentStatus,
      paypalOrderId,
      status: paymentStatus === 'completed' ? 'paid' : 'pending'
    }, { new: true });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
