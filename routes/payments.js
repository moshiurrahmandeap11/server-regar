const express = require('express');
const router = express.Router();
const payment = require('../controllers/paymentController');
const { auth, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/manual', auth, upload.single('proof'), payment.createManual);
router.post('/stripe/session', auth, payment.createStripeSession);

router.get('/', auth, adminOnly, payment.list);
router.get('/:id', auth, adminOnly, payment.get);
router.post('/:id/approve', auth, adminOnly, payment.approve);
router.post('/:id/decline', auth, adminOnly, payment.decline);

module.exports = router;
