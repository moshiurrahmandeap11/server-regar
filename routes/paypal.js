const express = require('express');
const router = express.Router();
const paypalController = require('../controllers/paypalController');
const { auth } = require('../middleware/auth');

router.post('/create', auth, paypalController.createPayment);
router.post('/execute', auth, paypalController.executePayment);

module.exports = router;
