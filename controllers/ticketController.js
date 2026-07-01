const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');

exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user._id })
      .populate('product', 'name images')
      .populate('raffle', 'name endDate')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getWinners = async (req, res) => {
  try {
    const winners = await Winner.find()
      .populate('user', 'firstName lastName')
      .populate('raffle', 'name')
      .sort({ createdAt: -1 });
    res.json(winners);
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
