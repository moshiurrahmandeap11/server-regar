const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, adminOnly } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', auth, authController.getMe);
router.put('/me', auth, authController.updateMe);
router.put('/me/password', auth, authController.updatePassword);
router.get('/', auth, adminOnly, authController.getAllUsers);
router.get('/:id', auth, adminOnly, authController.getUserDetail);
router.put('/:id/status', auth, adminOnly, authController.updateUserStatus);

module.exports = router;
