const User = require('../models/User');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');
const crypto = require('crypto');
const { hashPassword, comparePassword } = require('../utils/bcrypt');
const { generateToken } = require('../utils/jwt');
const { sendEmail } = require('../utils/mailer');

const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

const buildLocalizedUrl = (path) => `${frontendBaseUrl}/fr${path}`;

const createTokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateVerificationToken = () => crypto.randomBytes(32).toString('hex');

const sendVerificationEmail = async (user, rawToken) => {
  const verifyUrl = buildLocalizedUrl(`/verify-email?token=${rawToken}`);
  const subject = 'Verify your Regar account email';
  const html = `
    <p>Hello ${user.firstName || 'there'},</p>
    <p>Click the link below to verify your email address:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>This link expires in 24 hours.</p>
  `;

  return sendEmail({
    to: user.email,
    subject,
    html,
    text: `Verify your email: ${verifyUrl}`,
  });
};

const sendResetPasswordEmail = async (user, rawToken) => {
  const resetUrl = buildLocalizedUrl(`/password-reset?token=${rawToken}`);
  const subject = 'Reset your Regar password';
  const html = `
    <p>Hello ${user.firstName || 'there'},</p>
    <p>Click the link below to reset your password:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>This link expires in 30 minutes.</p>
  `;

  return sendEmail({
    to: user.email,
    subject,
    html,
    text: `Reset password: ${resetUrl}`,
  });
};

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = await hashPassword(password);
    const rawVerifyToken = generateVerificationToken();
    const verifyTokenHash = createTokenHash(rawVerifyToken);

    const user = new User({
      email: normalizedEmail,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      emailVerified: false,
      emailVerifyToken: verifyTokenHash,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await user.save();

    await sendVerificationEmail(user, rawVerifyToken);

    res.status(201).json({
      message: 'Account created. Please verify your email before logging in.',
      emailSent: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const envAdminPassword = process.env.ADMIN_PASSWORD;
    const isEnvAdminLogin = Boolean(
      envAdminEmail
      && envAdminPassword
      && normalizedEmail === envAdminEmail
      && password === envAdminPassword
    );

    if (isEnvAdminLogin) {
      let adminUser = await User.findOne({ email: envAdminEmail });

      if (!adminUser) {
        const hashedPassword = await hashPassword(envAdminPassword);
        adminUser = await User.create({
          email: envAdminEmail,
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'Regar',
          isAdmin: true,
          isActive: true,
          emailVerified: true,
          ageVerified: true,
          preferences: { language: 'fr', newsletter: false },
        });
      } else {
        adminUser.isAdmin = true;
        adminUser.isActive = true;
        adminUser.emailVerified = true;
        adminUser.password = await hashPassword(envAdminPassword);
        await adminUser.save();
      }

      const token = generateToken(adminUser._id);
      return res.json({
        token,
        user: {
          id: adminUser._id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          isAdmin: true,
          avatar: adminUser.avatar,
          emailVerified: true,
        }
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is suspended' });
    }

    if (!user.isAdmin && user.emailVerified === false) {
      return res.status(403).json({ message: 'Please verify your email before login' });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = generateToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
        emailVerified: user.emailVerified !== false,
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

    // address arrives as a JSON string from multipart/form-data — parse it back
    if (typeof updateData.address === 'string') {
      try {
        updateData.address = JSON.parse(updateData.address);
      } catch {
        delete updateData.address;
      }
    }

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

exports.verifyEmail = async (req, res) => {
  try {
    const rawToken = req.query.token?.trim();
    if (!rawToken) return res.status(400).json({ message: 'Verification token is required' });

    const tokenHash = createTokenHash(rawToken);
    const user = await User.findOne({
      emailVerifyToken: tokenHash,
      emailVerifyExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.resendVerificationEmail = async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.json({ message: 'If your email exists, a verification email has been sent' });
    }

    if (user.emailVerified) {
      return res.json({ message: 'Email is already verified' });
    }

    const rawVerifyToken = generateVerificationToken();
    user.emailVerifyToken = createTokenHash(rawVerifyToken);
    user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(user, rawVerifyToken);

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.json({ message: 'If your email exists, a reset link has been sent' });
    }

    const rawResetToken = generateVerificationToken();
    user.passwordResetToken = createTokenHash(rawResetToken);
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    await sendResetPasswordEmail(user, rawResetToken);

    res.json({ message: 'Reset email sent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const tokenHash = createTokenHash(token.trim());
    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = await hashPassword(newPassword);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.emailVerified = user.emailVerified !== false;
    await user.save();

    res.json({ message: 'Password reset successful' });
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
