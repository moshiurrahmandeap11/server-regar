const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');
const crypto = require('crypto');

exports.getRaffles = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const raffles = await Raffle.find(query)
      .populate('product', 'name nameEn images price soldTickets maxTickets raffleEndDate')
      .sort({ createdAt: -1 });
    res.json(raffles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRaffleById = async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id).populate('product').populate('winner', 'firstName lastName');
    if (!raffle) return res.status(404).json({ message: 'Raffle not found' });
    res.json(raffle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createRaffle = async (req, res) => {
  try {
    const raffle = new Raffle(req.body);
    await raffle.save();
    res.status(201).json(raffle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateRaffle = async (req, res) => {
  try {
    const raffle = await Raffle.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(raffle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.drawWinner = async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id);
    if (!raffle) return res.status(404).json({ message: 'Raffle not found' });

    if (raffle.status === 'drawn' || raffle.winner || raffle.winningTicket) {
      return res.status(400).json({ message: 'Winner already drawn for this raffle' });
    }

    if (!['active', 'closed'].includes(raffle.status)) {
      return res.status(400).json({ message: 'Only active or closed raffles can be drawn' });
    }

    if (raffle.endDate && new Date(raffle.endDate) > new Date()) {
      return res.status(400).json({ message: 'Raffle is still running. Close it or wait until end date.' });
    }

    const existingWinner = await Winner.findOne({ raffle: raffle._id });
    if (existingWinner) {
      return res.status(400).json({ message: 'Winner record already exists for this raffle' });
    }

    const tickets = await Ticket.find({ raffle: raffle._id });
    if (!tickets.length) return res.status(400).json({ message: 'No tickets for this raffle' });

    const winnerTicket = tickets[crypto.randomInt(0, tickets.length)];
    const prize = raffle.prizes[0];

    await Ticket.findByIdAndUpdate(winnerTicket._id, {
      isWinner: true, prize: prize?.name, drawDate: new Date()
    });
    await Raffle.findByIdAndUpdate(raffle._id, {
      winner: winnerTicket.user, winningTicket: winnerTicket.ticketNumber, status: 'drawn'
    });

    await Winner.create({
      user: winnerTicket.user, raffle: raffle._id, ticket: winnerTicket._id,
      prize: prize?.name || 'Grand Prize', prizeValue: prize?.value || 0,
      prizeEn: prize?.nameEn,
    });

    res.json({ winner: winnerTicket, prize });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
