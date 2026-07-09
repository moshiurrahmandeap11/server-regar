const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');

const generateTicketNumber = () => 'SUP-' + Date.now().toString(36).toUpperCase();

exports.createTicket = async (req, res) => {
  try {
    const { subject, message, category } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }

    const ticket = new SupportTicket({
      user: req.user._id,
      ticketNumber: generateTicketNumber(),
      subject,
      message,
      category: category || 'other',
      replies: [{ sender: 'user', message, createdAt: new Date() }],
    });
    await ticket.save();

    const populated = await SupportTicket.findById(ticket._id)
      .populate('user', 'firstName lastName email avatar')
      .populate('assignedTo', 'firstName lastName');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id })
      .sort({ lastReplyAt: -1 })
      .populate('user', 'firstName lastName email avatar')
      .populate('assignedTo', 'firstName lastName');
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTicketById = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('user', 'firstName lastName email avatar')
      .populate('assignedTo', 'firstName lastName');

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Only admin or ticket owner can view
    if (!req.user.isAdmin && ticket.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addReply = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Only admin or ticket owner can reply
    if (!req.user.isAdmin && ticket.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const sender = req.user.isAdmin ? 'admin' : 'user';

    ticket.replies.push({ sender, message, createdAt: new Date() });
    ticket.lastReplyAt = new Date();

    // Auto-update status
    if (sender === 'admin' && ticket.status === 'open') {
      ticket.status = 'in_progress';
    }
    if (sender === 'user' && ticket.status === 'resolved') {
      ticket.status = 'open';
    }

    await ticket.save();

    const populated = await SupportTicket.findById(ticket._id)
      .populate('user', 'firstName lastName email avatar')
      .populate('assignedTo', 'firstName lastName');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['open', 'in_progress', 'resolved', 'closed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    ticket.status = status;
    await ticket.save();

    const populated = await SupportTicket.findById(ticket._id)
      .populate('user', 'firstName lastName email avatar')
      .populate('assignedTo', 'firstName lastName');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllTickets = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { ticketNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const tickets = await SupportTicket.find(filter)
      .sort({ lastReplyAt: -1 })
      .populate('user', 'firstName lastName email avatar')
      .populate('assignedTo', 'firstName lastName');

    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.assignTicket = async (req, res) => {
  try {
    const { adminId } = req.body;
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { assignedTo: adminId },
      { new: true }
    )
      .populate('user', 'firstName lastName email avatar')
      .populate('assignedTo', 'firstName lastName');

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
