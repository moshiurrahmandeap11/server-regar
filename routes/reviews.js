const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find({ isApproved: true }).populate('user', 'firstName lastName').sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const review = new Review({ ...req.body, user: req.user._id, name: req.user.firstName + ' ' + req.user.lastName });
    await review.save();
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/admin', auth, adminOnly, async (req, res) => {
  try {
    const reviews = await Review.find().populate('user', 'firstName lastName').sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/approve', auth, adminOnly, async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, { isApproved: req.body.isApproved }, { new: true });
    res.json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
