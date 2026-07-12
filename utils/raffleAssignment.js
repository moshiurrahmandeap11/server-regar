const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');

const DRAW_ELIGIBLE_ORDER_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

/**
 * Find the single raffle that should receive tickets for a product at a given purchase time.
 * This is STRICT: only returns a raffle if the purchaseDate falls within [startDate, endDate].
 * If multiple raffles overlap (shouldn't happen with proper admin usage), picks the one
 * with the earliest endDate (most specific/current window).
 */
const resolveRaffleForProduct = async (productId, purchaseDate = new Date()) => {
  if (!productId) return null;

  const date = new Date(purchaseDate);
  const product = productId.toString();

  // STRICT: Find raffles where purchaseDate falls within [startDate, endDate]
  const matchingRaffles = await Raffle.find({
    product,
    status: { $in: ['active', 'closed'] },
    startDate: { $lte: date },
    endDate: { $gte: date },
  })
    .select('_id startDate endDate createdAt')
    .sort({ endDate: 1, createdAt: -1 }) // Most specific window first
    .limit(5);

  if (matchingRaffles.length > 0) {
    return matchingRaffles[0]._id;
  }

  // Fallback: if no strict match, find the most recently ended raffle for this product
  // (for backfilling old tickets where raffle dates may have changed)
  const recentEnded = await Raffle.findOne({
    product,
    status: { $in: ['active', 'closed'] },
    endDate: { $lte: date },
  })
    .select('_id')
    .sort({ endDate: -1 });

  if (recentEnded) return recentEnded._id;

  // Last resort: any active raffle for this product
  const anyActive = await Raffle.findOne({
    product,
    status: 'active',
  })
    .select('_id')
    .sort({ createdAt: -1 });

  return anyActive?._id || null;
};

const getTicketReferenceDate = (ticket) => {
  return ticket?.order?.createdAt || ticket?.createdAt || new Date();
};

/**
 * Backfill tickets that have no raffle assigned.
 * Only assigns to raffles where the ticket's order date falls within the raffle window.
 */
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

/**
 * Backfill tickets for a specific raffle.
 * Only assigns tickets whose order date falls within this raffle's date window.
 */
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
    
    // STRICT: Only assign if ticket's order date falls within raffle window
    const inWindow =
      (!raffle.startDate || referenceDate >= raffle.startDate) &&
      (!raffle.endDate || referenceDate <= raffle.endDate);

    if (!inWindow) continue;

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
