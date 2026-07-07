const Notification = require('../models/Notification');

exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });

    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: send notification to a specific user or all users
exports.sendNotification = async (req, res) => {
  try {
    const { userId, title, message, link, type = 'admin' } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    if (userId) {
      // Send to specific user
      const notification = await Notification.create({
        user: userId,
        type,
        title: title.trim(),
        message: message.trim(),
        link: link || '',
      });
      res.status(201).json({ message: 'Notification sent', notification });
    } else {
      // Send to all users
      const User = require('../models/User');
      const users = await User.find({ isActive: true }).select('_id');
      const docs = users.map((u) => ({
        user: u._id,
        type,
        title: title.trim(),
        message: message.trim(),
        link: link || '',
      }));
      await Notification.insertMany(docs);
      res.status(201).json({ message: `Notification sent to ${users.length} users` });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: get all notifications (optionally filtered by user)
exports.getAllNotifications = async (req, res) => {
  try {
    const { userId, limit = 50 } = req.query;
    const query = userId ? { user: userId } : {};
    const notifications = await Notification.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper: create notification programmatically
exports.createNotification = async ({ user, type, title, message, link, metadata }) => {
  try {
    return await Notification.create({ user, type, title, message, link: link || '', metadata: metadata || {} });
  } catch (error) {
    console.error('Failed to create notification:', error.message);
    return null;
  }
};
