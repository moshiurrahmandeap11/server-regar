const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/faq', contentController.getFaqs);
router.post('/faq', auth, adminOnly, contentController.createFaq);
router.put('/faq/:id', auth, adminOnly, contentController.updateFaq);
router.delete('/faq/:id', auth, adminOnly, contentController.deleteFaq);
router.get('/:key', contentController.getContent);
router.put('/:key', auth, adminOnly, contentController.updateContent);
router.get('/settings', contentController.getSettings);
router.put('/settings', auth, adminOnly, contentController.updateSettings);
router.post('/newsletter', contentController.subscribeNewsletter);
router.get('/newsletters', auth, adminOnly, contentController.getNewsletters);
router.delete('/newsletter/:id', auth, adminOnly, contentController.deleteNewsletter);
// debug (dev only): latest newsletter
router.get('/newsletter/debug', contentController.getLastNewsletter);

module.exports = router;
