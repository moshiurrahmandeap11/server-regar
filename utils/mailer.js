const nodemailer = require('nodemailer');

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 587);
  const user = process.env.EMAIL_USER;
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  if (!host || !user || !pass) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return cachedTransporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();

  if (!transporter) {
    return { sent: false, skipped: true, reason: 'SMTP config is missing' };
  }

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  await transporter.sendMail({ from, to, subject, html, text });

  return { sent: true };
};

module.exports = { sendEmail };
