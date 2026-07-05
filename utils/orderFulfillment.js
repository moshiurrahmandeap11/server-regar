const Order = require('../models/Order');
const Product = require('../models/Product');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { sendInvoiceEmail } = require('./sendInvoiceEmail');
const { resolveRaffleForProduct } = require('./raffleAssignment');

const generateTicketNumbers = (count) => {
  const unique = new Set();
  while (unique.size < count) {
    const candidate = `TKT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    unique.add(candidate);
  }
  return Array.from(unique);
};

const fulfillPaidOrder = async (orderId, paymentUpdate = {}) => {
  const order = await Order.findById(orderId);
  if (!order) return null;

  if (Array.isArray(order.tickets) && order.tickets.length > 0) {
    order.paymentStatus = 'completed';
    order.status = 'paid';
    Object.assign(order, paymentUpdate);
    await order.save();
    return order;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const totalTicketCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const tickets = generateTicketNumbers(totalTicketCount);

  let ticketOffset = 0;
  const ticketDocs = [];
  for (const item of items) {
    const qty = item.quantity || 1;
    const raffleId = await resolveRaffleForProduct(item.product, order.createdAt);

    for (let i = 0; i < qty; i += 1) {
      ticketDocs.push({
        ticketNumber: tickets[ticketOffset + i],
        user: order.user,
        order: order._id,
        product: item.product,
        raffle: raffleId || undefined,
      });
    }

    ticketOffset += qty;
    await Product.findByIdAndUpdate(item.product, { $inc: { soldTickets: qty, stock: -qty } });
  }

  order.tickets = tickets;
  order.paymentStatus = 'completed';
  order.status = 'paid';
  Object.assign(order, paymentUpdate);
  await order.save();

  if (ticketDocs.length) {
    await Ticket.insertMany(ticketDocs);
  }

  try {
    const user = await User.findById(order.user).select('email firstName');
    if (user?.email) {
      sendInvoiceEmail({
        to: user.email,
        firstName: user.firstName,
        order: order.toObject(),
      }).catch((err) => console.error('Invoice email failed:', err.message));
    }
  } catch (mailErr) {
    console.error('Invoice email setup failed:', mailErr.message);
  }

  return order;
};

module.exports = { fulfillPaidOrder };
