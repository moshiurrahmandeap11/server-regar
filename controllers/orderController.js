const Order = require('../models/Order');
const Product = require('../models/Product');
const Ticket = require('../models/Ticket');
const Raffle = require('../models/Raffle');

const generateOrderNumber = () => 'REG-' + Date.now().toString(36).toUpperCase();
const generateTicketNumbers = (count) => {
  const unique = new Set();
  while (unique.size < count) {
    const candidate = `TKT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    unique.add(candidate);
  }
  return Array.from(unique);
};

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
    const totalTicketCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const tickets = generateTicketNumbers(totalTicketCount);

    const productIds = items.map((item) => item.product).filter(Boolean);
    const now = new Date();
    const activeRaffles = await Raffle.find({
      product: { $in: productIds },
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .select('_id product endDate')
      .sort({ endDate: 1 });

    const raffleByProduct = new Map();
    activeRaffles.forEach((raffle) => {
      const productKey = raffle.product?.toString();
      if (productKey && !raffleByProduct.has(productKey)) {
        raffleByProduct.set(productKey, raffle._id);
      }
    });

    const raffleIds = [...new Set([...raffleByProduct.values()].map((id) => id.toString()))];
    const existingParticipationSet = new Set();

    if (raffleIds.length) {
      const existingParticipations = await Ticket.find({
        user: req.user._id,
        raffle: { $in: raffleIds },
      }).select('raffle');

      existingParticipations.forEach((ticket) => {
        if (ticket.raffle) existingParticipationSet.add(ticket.raffle.toString());
      });
    }

    const participatedInThisOrder = new Set();
    const participationSkippedProducts = [];

    let ticketOffset = 0;
    const ticketDocs = [];
    for (const item of items) {
      const qty = item.quantity || 1;

      const productId = item.product?.toString();
      const raffleId = productId ? raffleByProduct.get(productId)?.toString() : null;

      const alreadyParticipated = raffleId
        ? existingParticipationSet.has(raffleId) || participatedInThisOrder.has(raffleId)
        : false;

      if (raffleId && alreadyParticipated) {
        participationSkippedProducts.push(productId);
      }

      for (let i = 0; i < qty; i += 1) {
        const shouldAssignRaffle = Boolean(
          raffleId
          && !existingParticipationSet.has(raffleId)
          && !participatedInThisOrder.has(raffleId)
          && i === 0
        );

        if (shouldAssignRaffle) {
          participatedInThisOrder.add(raffleId);
        }

        ticketDocs.push({
          ticketNumber: tickets[ticketOffset + i],
          user: req.user._id,
          product: item.product,
          raffle: shouldAssignRaffle ? raffleId : undefined,
        });
      }

      ticketOffset += qty;
      await Product.findByIdAndUpdate(item.product, { $inc: { soldTickets: qty, stock: -qty } });
    }

    const order = new Order({
      user: req.user._id, orderNumber, items, shippingAddress,
      subtotal, shipping, discount, total, paymentMethod, tickets,
    });
    await order.save();

    await Ticket.insertMany(ticketDocs.map((ticket) => ({ ...ticket, order: order._id })));

    const response = order.toObject();
    response.participationSkippedProducts = [...new Set(participationSkippedProducts)].filter(Boolean);
    res.status(201).json(response);
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
    const order = await Order.findByIdAndUpdate(req.params.id, {
      paymentStatus,
      providerPaymentId,
      status: paymentStatus === 'completed' ? 'paid' : 'pending'
    }, { new: true });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
