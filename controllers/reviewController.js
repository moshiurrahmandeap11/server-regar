const Review = require('../models/Review');

exports.getApprovedReviews = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query?.limit || '0', 10) || 0, 0), 50);
    const query = { isApproved: true };
    if (req.query?.product) query.product = req.query.product;

    const reviews = await Review.find(query)
      .populate('user', 'firstName lastName email')
      .populate('product', 'name nameEn')
      .sort({ createdAt: -1 })
      .limit(limit || 0);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createReview = async (req, res) => {
  try {
    const { rating, comment, commentEn, product } = req.body;
    if (!product) return res.status(400).json({ message: 'Product is required' });
    if (!rating || !comment) return res.status(400).json({ message: 'Rating and comment are required' });

    const payload = {
      product,
      rating,
      comment,
      commentEn,
      user: req.user._id,
      name: req.user.firstName + ' ' + req.user.lastName,
      isApproved: true,
    };

    const existing = await Review.findOne({ user: req.user._id, product });
    const review = existing
      ? await Review.findByIdAndUpdate(existing._id, payload, { new: true })
      : await Review.create(payload);

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'firstName lastName email')
      .populate('product', 'name nameEn')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.toggleApproval = async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, { isApproved: req.body.isApproved }, { new: true });
    res.json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
