const User = require('../models/User');
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
