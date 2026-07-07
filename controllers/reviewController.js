const Review = require('../models/Review');
const Product = require('../models/Product');

const seededReviews = [
  {
    name: 'Sarah Johnson',
    avatar: 'https://i.pravatar.cc/160?img=47',
    rating: 5,
    comment: 'The cap feels premium and the raffle entry appeared right after my order. Smooth experience.',
    commentEn: 'The cap feels premium and the raffle entry appeared right after my order. Smooth experience.',
  },
  {
    name: 'Michael Brown',
    avatar: 'https://i.pravatar.cc/160?img=12',
    rating: 5,
    comment: 'Fast delivery, clean packaging, and the ticket flow was easy to follow.',
    commentEn: 'Fast delivery, clean packaging, and the ticket flow was easy to follow.',
  },
  {
    name: 'Emma Wilson',
    avatar: 'https://i.pravatar.cc/160?img=32',
    rating: 5,
    comment: 'I joined for the raffle, but the cap quality surprised me. Looks sharp.',
    commentEn: 'I joined for the raffle, but the cap quality surprised me. Looks sharp.',
  },
];

exports.getApprovedReviews = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query?.limit || '0', 10) || 0, 0), 50);
    const query = { isApproved: true };
    if (req.query?.product) query.product = req.query.product;

    const reviews = await Review.find(query)
      .populate('user', 'firstName lastName email avatar')
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
      .populate('user', 'firstName lastName email avatar')
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

exports.seedReviews = async (req, res) => {
  try {
    const product = await Product.findOne({ isActive: { $ne: false } }).sort({ createdAt: -1 });
    if (!product) return res.status(400).json({ message: 'Create an active product before adding sample reviews' });

    const created = [];
    for (const item of seededReviews) {
      const exists = await Review.findOne({ name: item.name, isSeeded: true });
      if (exists) continue;
      created.push(await Review.create({
        ...item,
        product: product._id,
        isApproved: true,
        isSeeded: true,
      }));
    }

    res.status(201).json({ message: 'Sample reviews added', created });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    res.json({ message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
