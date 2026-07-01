const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');

exports.getDashboard = async (req, res) => {
  try {
    const totalRevenue = await Order.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const totalOrders = await Order.countDocuments();
    const totalUsers = await User.countDocuments();
    const activeRaffles = await Product.countDocuments({
      isActive: true, raffleEndDate: { $gt: new Date() }
    });
    const recentOrders = await Order.find()
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 }).limit(10);
    const topProducts = await Order.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.name', count: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      totalRevenue: totalRevenue[0]?.total || 0,
      totalOrders, totalUsers, activeRaffles, recentOrders, topProducts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSales = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    const now = new Date();
    const months = 12;
    const sales = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const result = await Order.aggregate([
        { $match: { createdAt: { $gte: date, $lt: endDate }, paymentStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]);
      sales.push({
        month: date.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }),
        revenue: result[0]?.total || 0,
        orders: result[0]?.count || 0,
      });
    }
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
