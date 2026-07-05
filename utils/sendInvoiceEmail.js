const { sendEmail } = require('./mailer');

const SITE_NAME = process.env.SITE_NAME || 'Regar';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const CURRENCY = 'CHF';

/**
 * Formats a number as a currency string, e.g. 29.90
 */
const fmt = (n) => Number(n || 0).toFixed(2);

/**
 * Sends an order invoice email to the customer.
 *
 * @param {object} opts
 * @param {string}  opts.to           - recipient email
 * @param {string}  opts.firstName    - customer first name
 * @param {object}  opts.order        - plain order object (mongoose doc or plain object)
 */
const sendInvoiceEmail = async ({ to, firstName, order }) => {
  if (!to || !order) return { sent: false, reason: 'Missing to or order' };

  const itemRows = Array.isArray(order.items)
    ? order.items
        .map(
          (item) => `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">
              ${item.name || 'Item'}
              ${item.color ? `<span style="color:#9ca3af;font-size:12px;"> · ${item.color}</span>` : ''}
              ${item.size ? `<span style="color:#9ca3af;font-size:12px;"> · ${item.size}</span>` : ''}
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;text-align:center;">
              ${item.quantity || 1}
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;text-align:right;">
              ${fmt(item.price)} ${CURRENCY}
            </td>
          </tr>`
        )
        .join('')
    : '';

  const ticketLines =
    Array.isArray(order.tickets) && order.tickets.length
      ? `
        <div style="margin-top:24px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">
            Your Raffle Ticket${order.tickets.length > 1 ? 's' : ''}
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${order.tickets
              .map(
                (t) =>
                  `<span style="display:inline-block;background:#111827;color:#fff;font-family:monospace;
                               font-size:13px;font-weight:700;padding:6px 12px;border-radius:6px;letter-spacing:1px;">${t}</span>`
              )
              .join('')}
          </div>
        </div>`
      : '';

  const addr = order.shippingAddress || {};
  const addressBlock =
    addr.street
      ? `
        <div style="margin-top:24px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">
            Shipping Address
          </p>
          <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;">
            ${addr.firstName || ''} ${addr.lastName || ''}<br>
            ${addr.street || ''}<br>
            ${addr.zip || ''} ${addr.city || ''}<br>
            ${addr.country || ''}
          </p>
        </div>`
      : '';

  const discountRow =
    Number(order.discount) > 0
      ? `<tr>
           <td style="padding:4px 0;font-size:14px;color:#4b5563;">Discount</td>
           <td style="padding:4px 0;font-size:14px;color:#059669;text-align:right;">− ${fmt(order.discount)} ${CURRENCY}</td>
         </tr>`
      : '';

  const orderUrl = `${FRONTEND_URL}/fr/order-detail?id=${order._id || ''}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1f2937;">

      <!-- Header -->
      <div style="background:#111827;padding:24px 32px;border-radius:12px 12px 0 0;text-align:left;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:1px;">${SITE_NAME}</h1>
        <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">Order Confirmation</p>
      </div>

      <!-- Body -->
      <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;">

        <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#111827;">
          Hi ${firstName || 'there'}, your order is confirmed!
        </p>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
          Order number: <strong style="color:#111827;">${order.orderNumber || ''}</strong>
        </p>

        <!-- Items table -->
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 8px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Item</th>
              <th style="padding:10px 8px;text-align:center;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
              <th style="padding:10px 8px;text-align:right;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <!-- Totals -->
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#4b5563;">Subtotal</td>
            <td style="padding:4px 0;font-size:14px;color:#374151;text-align:right;">${fmt(order.subtotal)} ${CURRENCY}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#4b5563;">Shipping</td>
            <td style="padding:4px 0;font-size:14px;color:#374151;text-align:right;">${fmt(order.shipping)} ${CURRENCY}</td>
          </tr>
          ${discountRow}
          <tr>
            <td style="padding:12px 0 4px;font-size:16px;font-weight:700;color:#111827;border-top:2px solid #111827;">Total</td>
            <td style="padding:12px 0 4px;font-size:16px;font-weight:700;color:#111827;text-align:right;border-top:2px solid #111827;">${fmt(order.total)} ${CURRENCY}</td>
          </tr>
        </table>

        <!-- Tickets -->
        ${ticketLines}

        <!-- Shipping address -->
        ${addressBlock}

        <!-- CTA -->
        <div style="margin-top:32px;text-align:center;">
          <a href="${orderUrl}"
             style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;
                    padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
            View Order Details →
          </a>
        </div>

        <!-- Footer -->
        <p style="margin:32px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
          Questions? Contact us at <a href="mailto:${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'support@regar.ch'}" style="color:#6b7280;">${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'support@regar.ch'}</a><br>
          © ${new Date().getFullYear()} ${SITE_NAME}. All rights reserved.
        </p>
      </div>
    </div>
  `;

  const text = [
    `Hi ${firstName || 'there'}, your order is confirmed!`,
    `Order: ${order.orderNumber}`,
    `Total: ${fmt(order.total)} ${CURRENCY}`,
    order.tickets?.length ? `Ticket(s): ${order.tickets.join(', ')}` : '',
    `View order: ${orderUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return sendEmail({
    to,
    subject: `Your ${SITE_NAME} order ${order.orderNumber} is confirmed`,
    html,
    text,
  });
};

module.exports = { sendInvoiceEmail };
