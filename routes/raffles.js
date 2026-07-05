const express = require('express');
const router = express.Router();
const raffleController = require('../controllers/raffleController');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', raffleController.getRaffles);
router.get('/:id', raffleController.getRaffleById);
router.post('/', auth, adminOnly, raffleController.createRaffle);
router.put('/:id', auth, adminOnly, raffleController.updateRaffle);
router.delete('/:id', auth, adminOnly, raffleController.deleteRaffle);
router.post('/:id/draw', auth, adminOnly, raffleController.drawWinner);

module.exports = router;
