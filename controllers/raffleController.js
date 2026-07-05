const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const crypto = require('crypto');

const syncExpiredRaffles = async () => {
  await Raffle.updateMany(
    { status: 'active', endDate: { $lt: new Date() } },
    { $set: { status: 'closed' } }
  );
};

exports.getRaffles = async (req, res) => {
  try {
    await syncExpiredRaffles();

    const { status, eligibleForDraw, product } = req.query;
    const query = status ? { status } : {};
    if (product) {
      if (mongoose.Types.ObjectId.isValid(product)) {
        query.product = product;
      } else {
        const productDoc = await Product.findOne({ slug: product }).select('_id');
        query.product = productDoc?._id || null;
      }
    }

    const raffles = await Raffle.find(query)
      .populate('product', 'name nameEn slug description descriptionEn images price soldTickets maxTickets raffleEndDate')
      .sort({ createdAt: -1 });
    await Promise.all(raffles.map((raffle) => raffle.product?.ensureSlug?.()).filter(Boolean));

    const ticketCounts = await Ticket.aggregate([
      { $match: { raffle: { $ne: null } } },
      { $group: { _id: '$raffle', total: { $sum: 1 } } },
    ]);

    const ticketCountByRaffle = new Map(ticketCounts.map((row) => [String(row._id), row.total]));

    let enriched = raffles.map((raffle) => {
      const ticketCount = ticketCountByRaffle.get(String(raffle._id)) || 0;
      const isEnded = raffle.endDate ? new Date(raffle.endDate) <= new Date() : false;
      const canDraw = ['active', 'closed'].includes(raffle.status) && !raffle.winner && isEnded && ticketCount > 0;

      return {
        ...raffle.toObject(),
        ticketCount,
        canDraw,
      };
    });

    if (eligibleForDraw === 'true') {
      enriched = enriched.filter((raffle) => raffle.canDraw);
    }

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRaffleById = async (req, res) => {
  try {
    await syncExpiredRaffles();
    const raffle = await Raffle.findById(req.params.id).populate('product').populate('winner', 'firstName lastName');
    if (!raffle) return res.status(404).json({ message: 'Raffle not found' });
    res.json(raffle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createRaffle = async (req, res) => {
  try {
    // Auto-assign the next raffle number
    const last = await Raffle.findOne({}, { raffleNumber: 1 }).sort({ raffleNumber: -1 });
    const nextNumber = (last?.raffleNumber || 0) + 1;

    const raffle = new Raffle({ ...req.body, raffleNumber: nextNumber });
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
    await syncExpiredRaffles();

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

    let tickets = await Ticket.find({ raffle: raffle._id, isWinner: false });

    if (!tickets.length && raffle.product) {
      const backfillQuery = {
        $or: [{ raffle: { $exists: false } }, { raffle: null }],
        product: raffle.product,
      };

      if (raffle.startDate || raffle.endDate) {
        backfillQuery.createdAt = {};
        if (raffle.startDate) backfillQuery.createdAt.$gte = raffle.startDate;
        if (raffle.endDate) backfillQuery.createdAt.$lte = raffle.endDate;
      }

      await Ticket.updateMany(backfillQuery, { $set: { raffle: raffle._id } });
      tickets = await Ticket.find({ raffle: raffle._id, isWinner: false });
    }

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
