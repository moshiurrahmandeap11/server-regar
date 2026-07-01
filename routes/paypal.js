const express = require('express');
const router = express.Router();
const paypal = require('paypal-rest-sdk');
const Order = require('../models/Order');
const { auth } = require('../middleware/auth');

paypal.configure({
  mode: 'sandbox',
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

router.post('/create', auth, async (req, res) => {
  try {
    const { orderId, total } = req.body;
    const create_payment_json = {
      intent: 'sale',
      payer: { payment_method: 'paypal' },
      redirect_urls: {
        return_url: `${process.env.FRONTEND_URL}/checkout/success`,
        cancel_url: `${process.env.FRONTEND_URL}/checkout/cancel`,
      },
      transactions: [{
        amount: { currency: 'CHF', total: total.toFixed(2) },
        description: `Order ${orderId}`,
      }],
    };

    paypal.payment.create(create_payment_json, (error, payment) => {
      if (error) return res.status(500).json({ message: error.message });
      const approvalUrl = payment.links.find(l => l.rel === 'approval_url')?.href;
      res.json({ paymentId: payment.id, approvalUrl });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/execute', auth, async (req, res) => {
  try {
    const { paymentId, payerId, orderId } = req.body;
    const execute_payment_json = { payer_id: payerId };

    paypal.payment.execute(paymentId, execute_payment_json, async (error, payment) => {
      if (error) return res.status(500).json({ message: error.message });
      await Order.findByIdAndUpdate(orderId, { paymentStatus: 'completed', status: 'paid', paypalOrderId: payment.id });
      res.json({ success: true, payment });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
