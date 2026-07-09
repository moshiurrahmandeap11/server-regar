const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  sender: { type: String, enum: ['user', 'admin'], required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const supportTicketSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticketNumber: { type: String, required: true, unique: true },
  subject: { type: String, required: true },
  category: { type: String, enum: ['order', 'payment', 'product', 'account', 'other'], default: 'other' },
  message: { type: String, required: true },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  replies: [replySchema],
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastReplyAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
