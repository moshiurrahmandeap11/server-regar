const express = require('express');
const router = express.Router();
const raffleController = require('../controllers/raffleController');
const { auth, adminOnly } = require('../middleware/auth');
const uploadPrize = require('../middleware/uploadPrize');

router.get('/', raffleController.getRaffles);
router.get('/:id', raffleController.getRaffleById);
router.post('/', auth, adminOnly, uploadPrize.any(), raffleController.createRaffle);
router.put('/:id', auth, adminOnly, uploadPrize.any(), raffleController.updateRaffle);
router.delete('/:id', auth, adminOnly, raffleController.deleteRaffle);
router.post('/:id/draw', auth, adminOnly, raffleController.drawWinner);

module.exports = router;
