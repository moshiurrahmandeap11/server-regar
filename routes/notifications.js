const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendNotification,
  getAllNotifications,
} = require('../controllers/notificationController');

// User routes
router.get('/my', auth, getMyNotifications);
router.put('/:id/read', auth, markAsRead);
router.put('/read-all', auth, markAllAsRead);
router.delete('/:id', auth, deleteNotification);

// Admin routes
router.get('/all', auth, adminOnly, getAllNotifications);
router.post('/send', auth, adminOnly, sendNotification);

module.exports = router;
