const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, adminOnly } = require('../middleware/auth');
const uploadAvatar = require('../middleware/uploadAvatar');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationEmail);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', auth, authController.getMe);
router.put('/me', auth, uploadAvatar.single('avatar'), authController.updateMe);
router.put('/me/password', auth, authController.updatePassword);
router.get('/', auth, adminOnly, authController.getAllUsers);
router.get('/:id', auth, adminOnly, authController.getUserDetail);
router.put('/:id/status', auth, adminOnly, authController.updateUserStatus);

module.exports = router;
