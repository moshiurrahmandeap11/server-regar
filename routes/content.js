const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');
const { auth, adminOnly } = require('../middleware/auth');
const uploadQr = require('../middleware/uploadQr');

router.get('/faq', contentController.getFaqs);
router.post('/faq', auth, adminOnly, contentController.createFaq);
router.put('/faq/:id', auth, adminOnly, contentController.updateFaq);
router.delete('/faq/:id', auth, adminOnly, contentController.deleteFaq);
router.get('/settings', contentController.getSettings);
router.put('/settings', auth, adminOnly, contentController.updateSettings);
router.post('/contact', contentController.createContactMessage);
router.get('/contacts', auth, adminOnly, contentController.getContactMessages);
router.put('/contacts/:id/status', auth, adminOnly, contentController.updateContactMessageStatus);
router.post('/newsletter', contentController.subscribeNewsletter);
router.get('/newsletters', auth, adminOnly, contentController.getNewsletters);
router.delete('/newsletter/:id', auth, adminOnly, contentController.deleteNewsletter);
// debug (dev only): latest newsletter
router.get('/newsletter/debug', contentController.getLastNewsletter);

// Payment methods
router.get('/payment-methods', contentController.getPaymentMethods);
router.post('/payment-methods', auth, adminOnly, uploadQr.single('qrImage'), contentController.createPaymentMethod);
router.put('/payment-methods/:id', auth, adminOnly, uploadQr.single('qrImage'), contentController.updatePaymentMethod);
router.delete('/payment-methods/:id', auth, adminOnly, contentController.deletePaymentMethod);

router.get('/:key', contentController.getContent);
router.put('/:key', auth, adminOnly, contentController.updateContent);

module.exports = router;
