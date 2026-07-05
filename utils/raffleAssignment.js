const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');

const DRAW_ELIGIBLE_ORDER_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

const resolveRaffleForProduct = async (productId, referenceDate = new Date()) => {
  if (!productId) return null;

  const date = referenceDate ? new Date(referenceDate) : new Date();
  const product = productId.toString();

  const matchingWindow = await Raffle.findOne({
    product,
    status: { $in: ['active', 'closed', 'drawn'] },
    startDate: { $lte: date },
    endDate: { $gte: date },
  })
    .select('_id')
    .sort({ endDate: 1 });

  if (matchingWindow?._id) return matchingWindow._id;

  const currentActive = await Raffle.findOne({
    product,
    status: 'active',
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() },
  })
    .select('_id')
    .sort({ endDate: 1 });

  return currentActive?._id || null;
};

const getTicketReferenceDate = (ticket) => {
  return ticket?.order?.createdAt || ticket?.createdAt || new Date();
};

const backfillMissingTicketRaffles = async (baseQuery = {}) => {
  const query = {
    ...baseQuery,
    product: { $exists: true, $ne: null },
    $or: [{ raffle: { $exists: false } }, { raffle: null }],
  };

  const tickets = await Ticket.find(query)
    .select('_id product order createdAt')
    .populate('order', 'createdAt paymentStatus status')
    .limit(1000);

  let updated = 0;
  for (const ticket of tickets) {
    const raffleId = await resolveRaffleForProduct(ticket.product, getTicketReferenceDate(ticket));
    if (!raffleId) continue;

    await Ticket.updateOne(
      { _id: ticket._id, $or: [{ raffle: { $exists: false } }, { raffle: null }] },
      { $set: { raffle: raffleId } }
    );
    updated += 1;
  }

  return updated;
};

const backfillTicketsForRaffle = async (raffle) => {
  if (!raffle?.product) return 0;

  const query = {
    product: raffle.product,
    $or: [{ raffle: { $exists: false } }, { raffle: null }],
  };

  const tickets = await Ticket.find(query)
    .select('_id order createdAt')
    .populate('order', 'createdAt paymentStatus status')
    .limit(1000);

  let updated = 0;
  for (const ticket of tickets) {
    const referenceDate = getTicketReferenceDate(ticket);
    const inWindow =
      (!raffle.startDate || referenceDate >= raffle.startDate) &&
      (!raffle.endDate || referenceDate <= raffle.endDate);

    if (!inWindow) continue;

    await Ticket.updateOne(
      { _id: ticket._id, $or: [{ raffle: { $exists: false } }, { raffle: null }] },
      { $set: { raffle: raffle._id } }
    );
    updated += 1;
  }

  return updated;
};

const isDrawEligibleOrder = (order) => {
  return order?.paymentStatus === 'completed' && DRAW_ELIGIBLE_ORDER_STATUSES.includes(order?.status);
};

const paidTicketCountAggregation = (match = {}) => [
  { $match: { raffle: { $ne: null }, ...match } },
  {
    $lookup: {
      from: 'orders',
      localField: 'order',
      foreignField: '_id',
      as: 'orderDoc',
    },
  },
  { $unwind: '$orderDoc' },
  {
    $match: {
      'orderDoc.paymentStatus': 'completed',
      'orderDoc.status': { $in: DRAW_ELIGIBLE_ORDER_STATUSES },
    },
  },
  { $group: { _id: '$raffle', total: { $sum: 1 } } },
];

module.exports = {
  DRAW_ELIGIBLE_ORDER_STATUSES,
  resolveRaffleForProduct,
  backfillMissingTicketRaffles,
  backfillTicketsForRaffle,
  isDrawEligibleOrder,
  paidTicketCountAggregation,
};
