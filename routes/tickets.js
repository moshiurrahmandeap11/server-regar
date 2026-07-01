const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', auth, adminOnly, ticketController.getAllTickets);
router.get('/my', auth, ticketController.getMyTickets);
router.get('/winners', ticketController.getWinners);
router.get('/:ticketNumber', ticketController.getTicketByNumber);
router.get('/winners/:id/claim', auth, ticketController.claimPrize);
router.put('/winners/:id/claim', auth, ticketController.claimPrize);
router.put('/winners/:id/status', auth, adminOnly, ticketController.updateWinnerStatus);

module.exports = router;
