const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');

const DRAW_ELIGIBLE_ORDER_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

const pickBestRaffle = (raffles = []) => {
  const priority = { active: 0, closed: 1, draft: 2, drawn: 3 };
  return raffles.sort((a, b) => {
    const statusDiff = (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.endDate || b.createdAt || 0) - new Date(a.endDate || a.createdAt || 0);
  })[0] || null;
};

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

  if (currentActive?._id) return currentActive._id;

  const sameProductRaffles = await Raffle.find({
    product,
    status: { $in: ['active', 'closed', 'draft', 'drawn'] },
  })
    .select('_id status endDate createdAt')
    .sort({ createdAt: -1, endDate: -1 })
    .limit(20);

  return pickBestRaffle(sameProductRaffles)?._id || null;
};

const getTicketReferenceDate = (ticket) => {
  return ticket?.order?.createdAt || ticket?.createdAt || new Date();
};

const backfillMissingTicketRaffles = async (baseQuery = {}) => {
  const query = {
    ...baseQuery,
    $or: [{ raffle: { $exists: false } }, { raffle: null }],
  };

  const tickets = await Ticket.find(query)
    .select('_id product order createdAt')
    .populate('order', 'createdAt paymentStatus status items.product')
    .limit(1000);

  let updated = 0;
  for (const ticket of tickets) {
    const productId = ticket.product || ticket.order?.items?.find((item) => item.product)?.product;
    const raffleId = await resolveRaffleForProduct(productId, getTicketReferenceDate(ticket));
    if (!raffleId) continue;

    const $set = { raffle: raffleId };
    if (!ticket.product && productId) $set.product = productId;

    await Ticket.updateOne({ _id: ticket._id }, { $set });
    updated += 1;
  }

  return updated;
};

const backfillTicketsForRaffle = async (raffle) => {
  if (!raffle?.product) return 0;

  const query = {
    $or: [{ raffle: { $exists: false } }, { raffle: null }],
  };

  const tickets = await Ticket.find(query)
    .select('_id product order createdAt')
    .populate('order', 'createdAt paymentStatus status items.product')
    .limit(1000);

  let updated = 0;
  for (const ticket of tickets) {
    const productId = ticket.product || ticket.order?.items?.find((item) => item.product)?.product;
    if (!productId || String(productId) !== String(raffle.product)) continue;

    const referenceDate = getTicketReferenceDate(ticket);
    const inWindow =
      (!raffle.startDate || referenceDate >= raffle.startDate) &&
      (!raffle.endDate || referenceDate <= raffle.endDate);

    if (!inWindow && raffle.status !== 'active') continue;

    const $set = { raffle: raffle._id };
    if (!ticket.product) $set.product = productId;

    await Ticket.updateOne({ _id: ticket._id }, { $set });
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
