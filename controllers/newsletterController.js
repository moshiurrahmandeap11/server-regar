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

const FALLBACK_MARKETING_TEMPLATE = {
  subject: '🎉 New drop from {{siteName}}: {{productName}}',
  html: `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#111827;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:1px;">{{siteName}}</h1>
      </div>
      <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">New drop — {{productName}}</h2>
        <p style="margin:0 0 20px;color:#4b5563;line-height:1.7;">
          Hi {{email}},<br><br>
          We have something exciting for you. Check out the latest addition to the Regar collection below.
        </p>
        <a href="{{productUrl}}"
           style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;
                  padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.5px;">
          View Now →
        </a>
        <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
          You're receiving this because you subscribed to {{siteName}} updates.<br>
          {{year}} © {{siteName}}
        </p>
      </div>
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

const applyTemplateVars = (content = '', email = '', extra = {}) => {
  const siteName = process.env.SITE_NAME || 'Regar';
  let result = content
    .replaceAll('{{email}}', email)
    .replaceAll('{{siteName}}', siteName)
    .replaceAll('{{year}}', String(new Date().getFullYear()));

  // Extra vars: {{productName}}, {{productUrl}}, {{productLink}}
  if (extra.productName) result = result.replaceAll('{{productName}}', extra.productName);
  if (extra.productUrl) {
    result = result.replaceAll('{{productUrl}}', extra.productUrl);
    result = result.replaceAll(
      '{{productLink}}',
      `<a href="${extra.productUrl}" style="color:#111827;font-weight:600;">${extra.productName || extra.productUrl}</a>`,
    );
  }

  return result;
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

/**
 * Marketing send — sends a templated email to ALL active subscribers.
 * Body: { templateId, productName?, productUrl? }
 *
 * If the chosen template's html is empty, the built-in FALLBACK_MARKETING_TEMPLATE
 * is used so the email always has a proper body with the product link.
 * If the template has content but doesn't reference the product link vars, a
 * "View Now" button block is appended automatically before </div>.
 */
exports.sendMarketingEmail = async (req, res) => {
  try {
    const { templateId, productName = '', productUrl = '' } = req.body;

    if (!templateId) {
      return res.status(400).json({ message: 'templateId is required' });
    }

    const settings = await getSettings();
    const templates = Array.isArray(settings.newsletterTemplates) ? settings.newsletterTemplates : [];
    const selectedTemplate = templates.find((t) => String(t._id) === String(templateId));

    if (!selectedTemplate) {
      return res.status(400).json({ message: 'Template not found' });
    }

    const subscribers = await Newsletter.find({ isActive: true });

    if (!subscribers.length) {
      return res.status(404).json({ message: 'No active subscribers found' });
    }

    const extra = { productName, productUrl };

    // Decide which base html/subject to use
    const hasHtml = (selectedTemplate.html || '').trim().length > 0;
    let baseSubject = hasHtml ? selectedTemplate.subject : FALLBACK_MARKETING_TEMPLATE.subject;
    let baseHtml = hasHtml ? selectedTemplate.html : FALLBACK_MARKETING_TEMPLATE.html;

    // If the template has content but doesn't embed the product link, append a CTA button
    if (
      hasHtml &&
      productUrl &&
      !baseHtml.includes('{{productUrl}}') &&
      !baseHtml.includes('{{productLink}}')
    ) {
      const ctaBlock = `
        <div style="margin-top:24px;">
          <a href="${productUrl}"
             style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;
                    padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
            ${productName ? `View ${productName} →` : 'View Now →'}
          </a>
        </div>`;
      // Insert before the last closing tag, or just append
      if (baseHtml.lastIndexOf('</div>') !== -1) {
        const insertAt = baseHtml.lastIndexOf('</div>');
        baseHtml = baseHtml.slice(0, insertAt) + ctaBlock + baseHtml.slice(insertAt);
      } else {
        baseHtml += ctaBlock;
      }
    }

    const failed = [];

    await Promise.all(subscribers.map(async (subscriber) => {
      try {
        const subject = applyTemplateVars(baseSubject, subscriber.email, extra);
        const html = applyTemplateVars(baseHtml, subscriber.email, extra);

        const sendResult = await sendEmail({
          to: subscriber.email,
          subject,
          html,
          text: productUrl
            ? `${productName ? productName + ' — ' : ''}Check it out: ${productUrl}`
            : 'You have a new update from Regar.',
        });

        if (!sendResult.sent) {
          throw new Error(sendResult.reason || 'Email was skipped');
        }
      } catch (sendError) {
        failed.push({ email: subscriber.email, message: sendError.message });
      }
    }));

    res.json({
      message: 'Marketing email completed',
      total: subscribers.length,
      sent: subscribers.length - failed.length,
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
