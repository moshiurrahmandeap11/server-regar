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

// ─── Payment Methods ──────────────────────────────────────────────────────────

const getOrCreateSettings = async () => {
  let s = await Settings.findOne();
  if (!s) s = await Settings.create({});
  return s;
};

/** GET /api/content/payment-methods  (public — checkout needs to read them) */
exports.getPaymentMethods = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(Array.isArray(settings.paymentMethods) ? settings.paymentMethods : []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** POST /api/content/payment-methods  (admin) */
exports.createPaymentMethod = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'name is required' });
    }
    const qrImage = req.file?.path || '';
    const settings = await getOrCreateSettings();
    settings.paymentMethods.push({
      name: String(name).trim(),
      description: String(description || '').trim(),
      qrImage,
      isActive: isActive !== 'false' && isActive !== false,
    });
    await settings.save();
    const added = settings.paymentMethods[settings.paymentMethods.length - 1];
    res.status(201).json(added);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** PUT /api/content/payment-methods/:id  (admin) */
exports.updatePaymentMethod = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const method = settings.paymentMethods.id(req.params.id);
    if (!method) return res.status(404).json({ message: 'Payment method not found' });

    if (req.body.name !== undefined) method.name = String(req.body.name).trim();
    if (req.body.description !== undefined) method.description = String(req.body.description).trim();
    if (req.body.isActive !== undefined) method.isActive = req.body.isActive !== 'false' && req.body.isActive !== false;
    if (req.file?.path) method.qrImage = req.file.path;

    await settings.save();
    res.json(method);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** DELETE /api/content/payment-methods/:id  (admin) */
exports.deletePaymentMethod = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const method = settings.paymentMethods.id(req.params.id);
    if (!method) return res.status(404).json({ message: 'Payment method not found' });
    method.deleteOne();
    await settings.save();
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Hero Banner Management ──────────────────────────────────────────────────

const DEFAULT_HERO_BANNER = {
  image: '',
  buttonLink: '/products',
  en: {
    titleLine1: 'BUY A CAP.',
    titleLine2: 'WIN BIG.',
    subtitle: 'Purchase a cap and get automatic entry to win high-value prizes.',
    buttonText: 'BUY CAP & ENTER',
  },
  fr: {
    titleLine1: 'ACHETEZ UNE CASQUETTE.',
    titleLine2: 'GAGNEZ GROS.',
    subtitle: 'Achetez une casquette et obtenez une entree automatique pour gagner des prix de grande valeur.',
    buttonText: 'ACHETER ET ENTRER',
  },
};

exports.getHeroBanner = async (req, res) => {
  try {
    const doc = await Content.findOne({ key: 'hero-banner' });
    if (!doc) {
      return res.json(DEFAULT_HERO_BANNER);
    }

    let en = DEFAULT_HERO_BANNER.en;
    let fr = DEFAULT_HERO_BANNER.fr;
    if (doc.valueEn) {
      try { en = { ...en, ...JSON.parse(doc.valueEn) }; } catch (e) {}
    }
    if (doc.valueFr) {
      try { fr = { ...fr, ...JSON.parse(doc.valueFr) }; } catch (e) {}
    }

    const buttonLink = doc.meta?.buttonLink || DEFAULT_HERO_BANNER.buttonLink;

    res.json({
      image: doc.image || '',
      buttonLink,
      en,
      fr,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateHeroBanner = async (req, res) => {
  try {
    const { en, fr, buttonLink, resetImage } = req.body;

    let doc = await Content.findOne({ key: 'hero-banner' });
    if (!doc) {
      doc = new Content({ key: 'hero-banner' });
    }

    if (en) {
      const parsedEn = typeof en === 'string' ? JSON.parse(en) : en;
      doc.valueEn = JSON.stringify(parsedEn);
    }
    if (fr) {
      const parsedFr = typeof fr === 'string' ? JSON.parse(fr) : fr;
      doc.valueFr = JSON.stringify(parsedFr);
    }

    doc.meta = {
      ...(doc.meta || {}),
      buttonLink: buttonLink !== undefined ? String(buttonLink).trim() : (doc.meta?.buttonLink || '/products'),
    };

    if (resetImage === 'true' || resetImage === true) {
      doc.image = '';
    } else if (req.file?.path) {
      doc.image = req.file.path;
    } else if (req.body.image !== undefined) {
      doc.image = req.body.image;
    }

    await doc.save();

    let savedEn = DEFAULT_HERO_BANNER.en;
    let savedFr = DEFAULT_HERO_BANNER.fr;
    try { savedEn = { ...savedEn, ...JSON.parse(doc.valueEn) }; } catch (e) {}
    try { savedFr = { ...savedFr, ...JSON.parse(doc.valueFr) }; } catch (e) {}

    res.json({
      image: doc.image || '',
      buttonLink: doc.meta?.buttonLink || '/products',
      en: savedEn,
      fr: savedFr,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
