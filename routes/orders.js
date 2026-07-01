const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', auth, orderController.getOrders);
router.get('/track/:orderNumber', orderController.trackOrder);
router.get('/:id', auth, orderController.getOrderById);
router.post('/', auth, orderController.createOrder);
router.put('/:id/status', auth, adminOnly, orderController.updateStatus);
router.put('/:id/payment', auth, orderController.updatePayment);

module.exports = router;
