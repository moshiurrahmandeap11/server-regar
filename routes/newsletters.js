const express = require('express');
const router = express.Router();
const newsletter = require('../controllers/newsletterController');
const { auth, adminOnly } = require('../middleware/auth');

router.post('/', newsletter.subscribe);
router.get('/', auth, adminOnly, newsletter.list);
router.get('/templates', auth, adminOnly, newsletter.getTemplates);
router.post('/bulk-send', auth, adminOnly, newsletter.sendBulkEmail);
router.delete('/:id', auth, adminOnly, newsletter.remove);
// dev
router.get('/debug/latest', newsletter.last);

module.exports = router;
