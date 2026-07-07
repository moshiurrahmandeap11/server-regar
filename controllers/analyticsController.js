const Order = require('../models/Order');
const User = require('../models/User');
const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');

// Helper: get start of day
const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper: format date as short label
const formatLabel = (date) => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Generate last N days array with zero-filled data
const generateLastNDays = (n, dataMap) => {
  const result = [];
  const today = startOfDay(new Date());
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    result.push({ date: key, label: formatLabel(d), value: dataMap.get(key) || 0 });
  }
  return result;
};

// Compute percentage change between current and previous period
const computeChange = (current, previous) => {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

exports.getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [
      totalRevenueAgg,
      prevRevenueAgg,
      totalOrders,
      prevTotalOrders,
      totalUsers,
      prevTotalUsers,
      activeRaffles,
      prevActiveRaffles,
      recentOrders,
      topProductsAgg,
      ticketsLast30Days,
      prevTicketsLast30Days,
      ordersLast30Days,
      usersLast30Days,
    ] = await Promise.all([
      // Current period revenue
      Order.aggregate([
        { $match: { paymentStatus: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      // Previous period revenue
      Order.aggregate([
        { $match: { paymentStatus: 'completed', createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      // Current period orders
      Order.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      // Previous period orders
      Order.countDocuments({ createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      // Current period users
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      // Previous period users
      User.countDocuments({ createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      // Current active raffles
      Raffle.countDocuments({ status: 'active', endDate: { $gt: now } }),
      // Previous active raffles
      Raffle.countDocuments({ status: 'active', endDate: { $gt: thirtyDaysAgo, $lte: now } }),
      // Recent orders
      Order.find()
        .populate('user', 'firstName lastName email avatar')
        .sort({ createdAt: -1 })
        .limit(10),
      // Top products
      Order.aggregate([
        { $match: { paymentStatus: 'completed' } },
        { $unwind: '$items' },
        { $match: { 'items.quantity': { $gt: 0 }, 'items.price': { $gte: 0 } } },
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
            name: { $ifNull: ['$productDoc.name', { $ifNull: ['$productDoc.nameEn', '$fallbackName'] }] },
            count: 1,
            revenue: 1,
          },
        },
        { $sort: { count: -1, revenue: -1 } },
        { $limit: 5 },
      ]),
      // Tickets last 30 days grouped by day
      Ticket.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
      ]),
      // Tickets previous 30 days grouped by day
      Ticket.aggregate([
        { $match: { createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
      ]),
      // Orders last 30 days grouped by day
      Order.aggregate([
        { $match: { paymentStatus: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            revenue: { $sum: '$total' },
          },
        },
      ]),
      // Users last 30 days grouped by day
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalRevenue = Number(totalRevenueAgg?.[0]?.total || 0);
    const prevRevenue = Number(prevRevenueAgg?.[0]?.total || 0);
    const prevOrders = Number(prevTotalOrders || 0);
    const prevUsers = Number(prevTotalUsers || 0);

    const totalTickets = ticketsLast30Days.reduce((sum, t) => sum + t.count, 0);
    const prevTickets = prevTicketsLast30Days.reduce((sum, t) => sum + t.count, 0);

    const topProducts = topProductsAgg.map((p) => ({
      _id: p._id,
      name: p.name || 'Product',
      count: Number(p.count || 0),
      revenue: Number(p.revenue || 0),
    }));

    // Build daily data maps
    const ticketMap = new Map(ticketsLast30Days.map((t) => [t._id, t.count]));
    const orderMap = new Map(ordersLast30Days.map((o) => [o._id, o.count]));
    const userMap = new Map(usersLast30Days.map((u) => [u._id, u.count]));

    const dailyEntries = generateLastNDays(30, ticketMap);
    const dailyOrders = generateLastNDays(30, orderMap);
    const dailyUsers = generateLastNDays(30, userMap);

    res.json({
      totalRevenue,
      totalOrders,
      totalUsers,
      activeRaffles,
      recentOrders,
      topProducts,
      changes: {
        revenue: computeChange(totalRevenue, prevRevenue),
        orders: computeChange(totalOrders, prevOrders),
        users: computeChange(totalUsers, prevUsers),
        tickets: computeChange(totalTickets, prevTickets),
      },
      dailyData: {
        entries: dailyEntries,
        orders: dailyOrders,
        users: dailyUsers,
      },
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
