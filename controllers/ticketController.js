const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');

exports.getAllTickets = async (req, res) => {
  try {
    const { q, raffle, status } = req.query;
    const query = {};

    if (q) {
      query.ticketNumber = { $regex: q.trim(), $options: 'i' };
    }

    if (raffle) {
      query.raffle = raffle;
    }

    if (status === 'winner') {
      query.isWinner = true;
    }

    if (status === 'active') {
      query.isWinner = false;
    }

    const tickets = await Ticket.find(query)
      .populate('user', 'firstName lastName email')
      .populate('order', 'orderNumber status createdAt')
      .populate('product', 'name images')
      .populate('raffle', 'name status endDate')
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user._id })
      .populate('product', 'name images')
      .populate('raffle', 'name endDate')
      .populate('order', 'orderNumber status createdAt')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getWinners = async (req, res) => {
  try {
    const winners = await Winner.find()
      .populate('user', 'firstName lastName email')
      .populate('raffle', 'name status')
      .populate('ticket', 'ticketNumber drawDate')
      .sort({ createdAt: -1 });
    res.json(winners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTicketByNumber = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketNumber: req.params.ticketNumber.trim().toUpperCase() })
      .populate('user', 'firstName lastName')
      .populate('order', 'orderNumber createdAt status')
      .populate('raffle', 'name endDate')
      .populate('product', 'name images');

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    const safeTicket = {
      _id: ticket._id,
      ticketNumber: ticket.ticketNumber,
      isWinner: ticket.isWinner,
      prize: ticket.prize,
      drawDate: ticket.drawDate,
      createdAt: ticket.createdAt,
      user: ticket.user,
      order: ticket.order,
      raffle: ticket.raffle,
      product: ticket.product,
    };

    res.json(safeTicket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.claimPrize = async (req, res) => {
  try {
    const winner = await Winner.findByIdAndUpdate(req.params.id, {
      claimStatus: 'claimed', claimedAt: new Date()
    }, { new: true });
    res.json(winner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateWinnerStatus = async (req, res) => {
  try {
    const { claimStatus, trackingNumber } = req.body;
    const update = { claimStatus };
    if (trackingNumber) {
      update.trackingNumber = trackingNumber;
      update.shippedAt = new Date();
    }
    const winner = await Winner.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(winner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
