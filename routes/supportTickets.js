const express = require('express');
const router = express.Router();
const support = require('../controllers/supportTicketController');
const { auth, adminOnly } = require('../middleware/auth');

router.post('/', auth, support.createTicket);
router.get('/my', auth, support.getMyTickets);
router.get('/all', auth, adminOnly, support.getAllTickets);
router.get('/:id', auth, support.getTicketById);
router.post('/:id/reply', auth, support.addReply);
router.patch('/:id/status', auth, adminOnly, support.updateStatus);
router.patch('/:id/assign', auth, adminOnly, support.assignTicket);

module.exports = router;
