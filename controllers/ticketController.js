const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');
const Raffle = require('../models/Raffle');
const User = require('../models/User');
const Order = require('../models/Order');
const { createNotification } = require('../controllers/notificationController');
const { backfillMissingTicketRaffles, backfillTicketsForRaffle } = require('../utils/raffleAssignment');

const seededWinners = [
  {
    firstName: 'Amelie',
    lastName: 'Dubois',
    email: 'demo.winner.amelie@regar.ch',
    avatar: 'https://i.pravatar.cc/160?img=44',
    ticketNumber: 'DEMO-WIN-001',
    prize: 'Rolex Submariner',
    prizeEn: 'Rolex Submariner',
    prizeValue: 12000,
    claimStatus: 'claimed',
  },
  {
    firstName: 'Noah',
    lastName: 'Keller',
    email: 'demo.winner.noah@regar.ch',
    avatar: 'https://i.pravatar.cc/160?img=15',
    ticketNumber: 'DEMO-WIN-002',
    prize: 'iPhone 15 Pro Max',
    prizeEn: 'iPhone 15 Pro Max',
    prizeValue: 1599,
    claimStatus: 'shipped',
  },
  {
    firstName: 'Maya',
    lastName: 'Rossi',
    email: 'demo.winner.maya@regar.ch',
    avatar: 'https://i.pravatar.cc/160?img=28',
    ticketNumber: 'DEMO-WIN-003',
    prize: 'MacBook Pro 16',
    prizeEn: 'MacBook Pro 16',
    prizeValue: 2699,
    claimStatus: 'delivered',
  },
];

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

    if (raffle) {
      const raffleDoc = await Raffle.findById(raffle).select('_id product startDate endDate');
      if (raffleDoc) await backfillTicketsForRaffle(raffleDoc);
    } else {
      await backfillMissingTicketRaffles();
    }

    let tickets = await Ticket.find(query)
      .populate('user', 'firstName lastName email')
      .populate('order', 'orderNumber status paymentStatus createdAt')
      .populate('product', 'name images')
      .populate('raffle', 'name nameEn raffleNumber status endDate')
      .sort({ createdAt: -1 });

    if (status === 'active') {
      tickets = tickets.filter((ticket) => ticket.order?.paymentStatus === 'completed');
    }

    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyTickets = async (req, res) => {
  try {
    await backfillMissingTicketRaffles({ user: req.user._id });

    const tickets = await Ticket.find({ user: req.user._id })
      .populate('product', 'name images')
      .populate('raffle', 'name raffleNumber endDate')
      .populate('order', 'orderNumber status paymentStatus createdAt')
      .sort({ createdAt: -1 });
    res.json(tickets.filter((ticket) => ticket.order?.paymentStatus === 'completed'));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getWinners = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query?.limit || '0', 10) || 0, 0), 50);

    const winners = await Winner.find()
      .populate('user', 'firstName lastName email avatar')
      .populate('raffle', 'name nameEn status')
      .populate('ticket', 'ticketNumber drawDate')
      .sort({ drawDate: -1, createdAt: -1 })
      .limit(limit || 0);
    res.json(winners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTicketByNumber = async (req, res) => {
  try {
    await backfillMissingTicketRaffles();

    const ticket = await Ticket.findOne({ ticketNumber: req.params.ticketNumber.trim().toUpperCase() })
      .populate('user', 'firstName lastName')
      .populate('order', 'orderNumber createdAt status paymentStatus')
      .populate('raffle', 'name raffleNumber endDate')
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

    // Notify user when prize is shipped
    if (claimStatus === 'shipped' && trackingNumber) {
      await createNotification({
        user: winner.user,
        type: 'winner',
        title: 'Prize Shipped',
        message: `Your prize has been shipped. Tracking number: ${trackingNumber}.`,
        link: '/tickets',
      });
    }

    res.json(winner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.seedWinners = async (req, res) => {
  try {
    const raffle = await Raffle.findOne().populate('product').sort({ createdAt: -1 });
    if (!raffle || !raffle.product) {
      return res.status(400).json({ message: 'Create a raffle with a product before adding sample winners' });
    }

    const created = [];
    for (const item of seededWinners) {
      const existingWinner = await Winner.findOne({ isSeeded: true, prizeEn: item.prizeEn });
      if (existingWinner) continue;

      const user = await User.findOneAndUpdate(
        { email: item.email },
        {
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          password: 'sample-winner-not-for-login',
          avatar: item.avatar,
          isActive: true,
          emailVerified: true,
          ageVerified: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const order = await Order.findOneAndUpdate(
        { orderNumber: `DEMO-WINNER-${item.ticketNumber}` },
        {
          user: user._id,
          orderNumber: `DEMO-WINNER-${item.ticketNumber}`,
          items: [{
            product: raffle.product._id,
            name: raffle.product.name,
            price: raffle.product.price || 0,
            quantity: 1,
            image: raffle.product.images?.[0],
          }],
          shippingAddress: {
            firstName: item.firstName,
            lastName: item.lastName,
            country: 'Switzerland',
          },
          subtotal: raffle.product.price || 0,
          shipping: 0,
          discount: 0,
          total: raffle.product.price || 0,
          status: 'delivered',
          paymentMethod: 'manual',
          paymentStatus: 'completed',
          tickets: [item.ticketNumber],
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const ticket = await Ticket.findOneAndUpdate(
        { ticketNumber: item.ticketNumber },
        {
          ticketNumber: item.ticketNumber,
          user: user._id,
          order: order._id,
          product: raffle.product._id,
          raffle: raffle._id,
          isWinner: true,
          prize: item.prizeEn,
          drawDate: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      created.push(await Winner.create({
        user: user._id,
        raffle: raffle._id,
        ticket: ticket._id,
        prize: item.prize,
        prizeEn: item.prizeEn,
        prizeValue: item.prizeValue,
        claimStatus: item.claimStatus,
        claimedAt: item.claimStatus !== 'pending' ? new Date() : undefined,
        shippedAt: ['shipped', 'delivered'].includes(item.claimStatus) ? new Date() : undefined,
        trackingNumber: item.claimStatus === 'shipped' ? `DEMO-${item.ticketNumber}` : undefined,
        isSeeded: true,
      }));
    }

    res.status(201).json({ message: 'Sample winners added', created });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteWinner = async (req, res) => {
  try {
    const winner = await Winner.findById(req.params.id).populate('ticket').populate('user');
    if (!winner) return res.status(404).json({ message: 'Winner not found' });

    await Winner.findByIdAndDelete(winner._id);

    if (winner.isSeeded) {
      if (winner.ticket?._id) {
        await Order.deleteOne({ tickets: winner.ticket.ticketNumber });
        await Ticket.findByIdAndDelete(winner.ticket._id);
      }
      if (winner.user?.email?.startsWith('demo.winner.')) {
        await User.findByIdAndDelete(winner.user._id);
      }
    }

    res.json({ message: 'Winner deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
