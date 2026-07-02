const User = require('../models/User');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');
const { hashPassword, comparePassword } = require('../utils/bcrypt');
const { generateToken } = require('../utils/jwt');

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = await hashPassword(password);
    const user = new User({ email, password: hashedPassword, firstName, lastName, phone });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({
      token,
      user: { id: user._id, email, firstName, lastName, isAdmin: user.isAdmin }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = generateToken(user._id);
    res.json({
      token,
      user: {
        id: user._id, email, firstName: user.firstName, lastName: user.lastName,
        isAdmin: user.isAdmin, avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMe = async (req, res) => {
  res.json(req.user);
};

exports.updateMe = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.password;
    delete updateData.isAdmin;
    if (req.file) updateData.avatar = req.file.path;
    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
    user.password = await hashPassword(newPassword);
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const [orders, tickets, winners] = await Promise.all([
      Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(20),
      Ticket.find({ user: user._id })
        .populate('raffle', 'name status endDate')
        .populate('order', 'orderNumber status createdAt')
        .sort({ createdAt: -1 })
        .limit(50),
      Winner.find({ user: user._id })
        .populate('raffle', 'name status')
        .populate('ticket', 'ticketNumber drawDate')
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    const stats = {
      orders: orders.length,
      spent: orders.reduce((sum, order) => sum + (order.total || 0), 0),
      tickets: tickets.length,
      wins: winners.length,
      activeTickets: tickets.filter((ticket) => !ticket.isWinner).length,
    };

    res.json({ user, stats, orders, tickets, winners });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
