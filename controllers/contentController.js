const Faq = require('../models/Faq');
const Content = require('../models/Content');
const Settings = require('../models/Settings');
const Newsletter = require('../models/Newsletter');
const ContactMessage = require('../models/ContactMessage');

exports.getFaqs = async (req, res) => {
  try {
    const faqs = await Faq.find().sort({ order: 1 });
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createFaq = async (req, res) => {
  try {
    const faq = new Faq(req.body);
    await faq.save();
    res.status(201).json(faq);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateFaq = async (req, res) => {
  try {
    const faq = await Faq.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(faq);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteFaq = async (req, res) => {
  try {
    await Faq.findByIdAndDelete(req.params.id);
    res.json({ message: 'FAQ deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getContent = async (req, res) => {
  try {
    const content = await Content.findOne({ key: req.params.key });
    res.json(content);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateContent = async (req, res) => {
  try {
    const content = await Content.findOneAndUpdate(
      { key: req.params.key }, req.body, { new: true, upsert: true }
    );
    res.json(content);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate({}, { $set: req.body }, { new: true, upsert: true });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const contact = await ContactMessage.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      subject: String(subject).trim(),
      message: String(message).trim(),
    });

    res.status(201).json({
      message: 'Message sent successfully',
      id: contact._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getContactMessages = async (req, res) => {
  try {
    const status = req.query?.status;
    const query = status ? { status } : {};
    const list = await ContactMessage.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateContactMessageStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updated = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Message not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.subscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;
    const existing = await Newsletter.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already subscribed' });
    const newsletter = new Newsletter({ email });
    await newsletter.save();
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getNewsletters = async (req, res) => {
  try {
    const list = await Newsletter.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// TEMP: debug endpoint to check latest subscription (no auth) - remove in production
exports.getLastNewsletter = async (req, res) => {
  try {
    const last = await Newsletter.findOne().sort({ createdAt: -1 });
    res.json(last || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteNewsletter = async (req, res) => {
  try {
    await Newsletter.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
