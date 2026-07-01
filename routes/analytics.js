const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/dashboard', auth, adminOnly, analyticsController.getDashboard);
router.get('/sales', auth, adminOnly, analyticsController.getSales);

module.exports = router;
