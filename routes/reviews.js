const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', reviewController.getApprovedReviews);
router.post('/', auth, reviewController.createReview);
router.get('/admin', auth, adminOnly, reviewController.getAllReviews);
router.put('/:id/approve', auth, adminOnly, reviewController.toggleApproval);

module.exports = router;
