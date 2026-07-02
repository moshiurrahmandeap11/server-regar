const Newsletter = require('../models/Newsletter');
const Settings = require('../models/Settings');
const { sendEmail } = require('../utils/mailer');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FALLBACK_THANK_YOU_TEMPLATE = {
  subject: 'Thanks for subscribing to Regar',
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin: 0 0 12px;">Thanks for subscribing</h2>
      <p style="margin: 0 0 10px;">Hi {{email}},</p>
      <p style="margin: 0 0 10px;">Thank you for joining Regar newsletter. You will receive updates about new products, raffles, and offers.</p>
      <p style="margin: 16px 0 0;">Team Regar</p>
    </div>
  `,
};

const getSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  return settings;
};

const findTemplateByType = (templates = [], type) => {
  const sameType = templates.filter((template) => template.type === type);
  return sameType.find((template) => template.isDefault) || sameType[0] || null;
};

const applyTemplateVars = (content = '', email = '') => {
  const siteName = process.env.SITE_NAME || 'Regar';
  return content
    .replaceAll('{{email}}', email)
    .replaceAll('{{siteName}}', siteName)
    .replaceAll('{{year}}', String(new Date().getFullYear()));
};

exports.subscribe = async (req, res) => {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email required' });
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Invalid email address' });

    const existing = await Newsletter.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already subscribed' });

    const n = new Newsletter({ email });
    await n.save();

    try {
      const settings = await getSettings();
      const templates = Array.isArray(settings.newsletterTemplates) ? settings.newsletterTemplates : [];
      const thankYouTemplate = findTemplateByType(templates, 'THANK_YOU');

      const subject = applyTemplateVars(thankYouTemplate?.subject || FALLBACK_THANK_YOU_TEMPLATE.subject, email);
      const html = applyTemplateVars(thankYouTemplate?.html || FALLBACK_THANK_YOU_TEMPLATE.html, email);

      const sendResult = await sendEmail({
        to: email,
        subject,
        html,
        text: 'Thank you for subscribing to Regar newsletter.',
      });

      if (!sendResult.sent) {
        throw new Error(sendResult.reason || 'Thank-you email was skipped');
      }
    } catch (mailError) {
      console.error('Newsletter thank-you email failed:', mailError.message);
    }

    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.list = async (req, res) => {
  try {
    const list = await Newsletter.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await Newsletter.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTemplates = async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(Array.isArray(settings.newsletterTemplates) ? settings.newsletterTemplates : []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendBulkEmail = async (req, res) => {
  try {
    const { recipientIds = [], templateId } = req.body;

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({ message: 'At least one recipient is required' });
    }

    const settings = await getSettings();
    const templates = Array.isArray(settings.newsletterTemplates) ? settings.newsletterTemplates : [];
    const selectedTemplate = templates.find((template) => String(template._id) === String(templateId));

    if (!selectedTemplate) {
      return res.status(400).json({ message: 'Template not found' });
    }

    const recipients = await Newsletter.find({
      _id: { $in: recipientIds },
      isActive: true,
    });

    if (!recipients.length) {
      return res.status(404).json({ message: 'No active recipients found' });
    }

    const failed = [];

    await Promise.all(recipients.map(async (subscriber) => {
      try {
        const subject = applyTemplateVars(selectedTemplate.subject, subscriber.email);
        const html = applyTemplateVars(selectedTemplate.html, subscriber.email);

        const sendResult = await sendEmail({
          to: subscriber.email,
          subject,
          html,
          text: 'You received a newsletter update from Regar.',
        });

        if (!sendResult.sent) {
          throw new Error(sendResult.reason || 'Email was skipped');
        }
      } catch (sendError) {
        failed.push({ email: subscriber.email, message: sendError.message });
      }
    }));

    res.json({
      message: 'Bulk email completed',
      total: recipients.length,
      sent: recipients.length - failed.length,
      failed,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// dev helper
exports.last = async (req, res) => {
  try { const last = await Newsletter.findOne().sort({ createdAt: -1 }); res.json(last || null); } catch (error) { res.status(500).json({ message: error.message }); }
};
