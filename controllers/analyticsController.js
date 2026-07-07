const Order = require('../models/Order');
const User = require('../models/User');
const Raffle = require('../models/Raffle');

exports.getDashboard = async (req, res) => {
  try {
    const now = new Date();

    const [totalRevenueAgg, totalOrders, totalUsers, activeRaffles, recentOrders, topProductsAgg] = await Promise.all([
      Order.aggregate([
        { $match: { paymentStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.countDocuments(),
      User.countDocuments(),
      Raffle.countDocuments({ status: 'active', endDate: { $gt: now } }),
      Order.find()
        .populate('user', 'firstName lastName email avatar')
        .sort({ createdAt: -1 })
        .limit(10),
      Order.aggregate([
        { $match: { paymentStatus: 'completed' } },
        { $unwind: '$items' },
        {
          $match: {
            'items.quantity': { $gt: 0 },
            'items.price': { $gte: 0 },
          },
        },
        {
          $group: {
            _id: '$items.product',
            fallbackName: { $last: '$items.name' },
            count: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'productDoc',
          },
        },
        { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            name: {
              $ifNull: ['$productDoc.name', { $ifNull: ['$productDoc.nameEn', '$fallbackName'] }],
            },
            count: 1,
            revenue: 1,
          },
        },
        { $sort: { count: -1, revenue: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const totalRevenue = Number(totalRevenueAgg?.[0]?.total || 0);
    const topProducts = topProductsAgg.map((p) => ({
      _id: p._id,
      name: p.name || 'Product',
      count: Number(p.count || 0),
      revenue: Number(p.revenue || 0),
    }));

    res.json({
      totalRevenue,
      totalOrders, totalUsers, activeRaffles, recentOrders, topProducts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSales = async (req, res) => {
  try {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i -= 1) {
      months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }

    const startDate = months[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const grouped = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'completed',
          createdAt: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
    ]);

    const groupedMap = new Map(
      grouped.map((row) => [
        `${row._id.year}-${String(row._id.month).padStart(2, '0')}`,
        { total: Number(row.total || 0), count: Number(row.count || 0) },
      ])
    );

    const sales = months.map((date) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const row = groupedMap.get(key);
      return {
        month: date.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }),
        revenue: row?.total || 0,
        orders: row?.count || 0,
      };
    });

    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
