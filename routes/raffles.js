const express = require('express');
const router = express.Router();
const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const raffles = await Raffle.find(query).populate('product', 'name images price').sort({ createdAt: -1 });
    res.json(raffles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id).populate('product').populate('winner', 'firstName lastName');
    if (!raffle) return res.status(404).json({ message: 'Raffle not found' });
    res.json(raffle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const raffle = new Raffle(req.body);
    await raffle.save();
    res.status(201).json(raffle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const raffle = await Raffle.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(raffle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/draw', auth, adminOnly, async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id);
    if (!raffle) return res.status(404).json({ message: 'Raffle not found' });
    
    const tickets = await Ticket.find({ raffle: raffle._id });
    if (!tickets.length) return res.status(400).json({ message: 'No tickets for this raffle' });
    
    const winnerTicket = tickets[Math.floor(Math.random() * tickets.length)];
    const prize = raffle.prizes[0];
    
    await Ticket.findByIdAndUpdate(winnerTicket._id, { isWinner: true, prize: prize?.name, drawDate: new Date() });
    await Raffle.findByIdAndUpdate(raffle._id, { winner: winnerTicket.user, winningTicket: winnerTicket.ticketNumber, status: 'drawn' });
    
    await Winner.create({
      user: winnerTicket.user,
      raffle: raffle._id,
      ticket: winnerTicket._id,
      prize: prize?.name || 'Grand Prize',
      prizeValue: prize?.value || 0,
    });
    
    res.json({ winner: winnerTicket, prize });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
