const Payment = require('../models/Payment');
const Order = require('../models/Order');
const User = require('../models/User');
const stripeLib = require('stripe');
const { sendInvoiceEmail } = require('../utils/sendInvoiceEmail');

const stripeSecret = process.env.STRIPE_SECRET;
const stripe = stripeSecret ? stripeLib(stripeSecret) : null;

exports.createManual = async (req, res) => {
  try {
    const { orderId, amount, txId } = req.body;
    if (!orderId || !amount || !txId) {
      return res.status(400).json({ message: 'orderId, amount and txId are required' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (!req.user?.isAdmin && order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let proofUrl = null;
    if (req.file && req.file.path) proofUrl = req.file.path;

    const payment = new Payment({
      orderId,
      userId: req.user?._id,
      amount,
      method: 'manual',
      txId,
      proofUrl,
      status: 'pending',
    });
    await payment.save();

    await Order.findByIdAndUpdate(orderId, {
      paymentMethod: 'manual',
      paymentStatus: 'pending',
      status: 'pending',
    });

    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.list = async (req, res) => {
  try {
    const list = await Payment.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName email')
      .populate('orderId', 'orderNumber total paymentStatus status createdAt');

    const knownOrderIds = new Set(
      list
        .map((payment) => payment.orderId?._id || payment.orderId)
        .filter(Boolean)
        .map((id) => String(id))
    );

    const fallbackOrders = await Order.find({
      paymentMethod: { $in: ['stripe', 'manual'] },
      _id: { $nin: [...knownOrderIds] },
    })
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(200);

    const synthesized = fallbackOrders.map((order) => ({
      _id: `order-${order._id}`,
      orderId: {
        _id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        paymentStatus: order.paymentStatus,
        status: order.status,
        createdAt: order.createdAt,
      },
      userId: order.user,
      amount: order.total,
      currency: 'CHF',
      method: order.paymentMethod,
      status: order.paymentStatus === 'completed' ? 'paid' : 'pending',
      providerPaymentId: order.providerPaymentId,
      createdAt: order.createdAt,
      synthetic: true,
    }));

    const merged = [...list.map((item) => item.toObject()), ...synthesized]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(merged);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.get = async (req, res) => {
  try { const p = await Payment.findById(req.params.id); res.json(p); } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.approve = async (req, res) => {
  try {
    const p = await Payment.findByIdAndUpdate(req.params.id, { status: 'approved', adminNote: req.body.note || '' }, { new: true });
    if (p && p.orderId) {
      await Order.findByIdAndUpdate(p.orderId, {
        paymentStatus: 'completed',
        status: 'paid',
        paymentMethod: p.method,
        providerPaymentId: p.txId || p._id.toString(),
      });
    }
    res.json(p);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.decline = async (req, res) => {
  try { const p = await Payment.findByIdAndUpdate(req.params.id, { status: 'declined', adminNote: req.body.note || '' }, { new: true }); res.json(p); } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.createStripeSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ message: 'Stripe is not configured on server' });
    }

    const { orderId, amount, currency = 'CHF' } = req.body;
    if (!orderId || !amount) {
      return res.status(400).json({ message: 'orderId and amount are required' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (!req.user?.isAdmin && order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: currency.toLowerCase(), product_data: { name: `Order ${orderId}` }, unit_amount: Math.round(amount * 100) }, quantity: 1 }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/fr/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/fr/checkout`,
      metadata: { orderId: String(orderId), userId: String(req.user?._id || '') },
    });

    await Order.findByIdAndUpdate(orderId, {
      paymentMethod: 'stripe',
      paymentStatus: 'pending',
      providerPaymentId: session.id,
    });

    await Payment.findOneAndUpdate(
      { providerPaymentId: session.id },
      {
        orderId,
        userId: req.user?._id,
        amount,
        currency: currency.toUpperCase(),
        method: 'stripe',
        status: 'pending',
        providerPaymentId: session.id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ id: session.id, url: session.url });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.handleStripeWebhook = async (req, res) => {
  if (!stripe) return res.status(500).json({ message: 'Stripe is not configured on server' });

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;

    await Payment.findOneAndUpdate(
      { providerPaymentId: session.id },
      {
        orderId,
        amount: session.amount_total / 100,
        currency: session.currency.toUpperCase(),
        method: 'stripe',
        status: 'paid',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (orderId) {
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'completed',
        status: 'paid',
        paymentMethod: 'stripe',
        providerPaymentId: session.id,
      });
    }
  }
  res.json({ received: true });
};
