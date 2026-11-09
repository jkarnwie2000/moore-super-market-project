const Order = require('../models/Order');
const env = require('../config/env');
const { sendEmail } = require('./emailService');

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const lines = (order) => order.items.map((i) => ({ text: `${i.quantity} × ${i.name} (${i.size}) — ${money(i.lineTotal)}` }));

function totalsRows(order) {
  const rows = [['Subtotal', money(order.subtotal)]];
  if (order.discount > 0) rows.push([`Discount${order.promoCode ? ` (${order.promoCode})` : ''}`, `−${money(order.discount)}`]);
  rows.push([order.deliveryMethod === 'pickup' ? 'Store pickup' : 'Delivery', order.deliveryFee > 0 ? money(order.deliveryFee) : 'Free']);
  rows.push(['Tax', money(order.tax)]);
  rows.push(['Total paid', money(order.amountPaid || order.total)]);
  return rows;
}

function fulfilment(order) {
  const c = order.customer || {};
  if (order.deliveryMethod === 'pickup') return { title: 'Store pickup', detail: `${env.storeAddress}. We'll let you know when it's ready (usually within 2 hours).` };
  return { title: 'Home delivery', detail: [c.street, [c.city, c.state, c.zip].filter(Boolean).join(', '), c.country].filter(Boolean).join(', ') };
}

function layout(title, body) {
  return `<!doctype html><html><body style="margin:0;background:#fbf6ec;font-family:Arial,Helvetica,sans-serif;color:#1d2420">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#1f5135;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
    <div style="font-size:20px;font-weight:bold">Moore Supermarket</div>
    <div style="color:#e2a92b;font-size:12px;letter-spacing:2px">AFRICAN &amp; CARIBBEAN GROCERIES</div>
  </div>
  <div style="background:#fff;padding:22px;border:1px solid #e6dcc8;border-top:0;border-radius:0 0 12px 12px">
    <h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
    ${body}
  </div>
  <p style="font-size:12px;color:#5b6158;text-align:center;margin-top:16px">${esc(env.storeAddress)}</p>
</div></body></html>`;
}

function itemsTable(order) {
  const rows = order.items
    .map(
      (i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #efe7d7">${esc(i.name)}<br><span style="color:#5b6158;font-size:13px">${esc(i.size)} · ${i.quantity} × ${money(i.unitPrice)}</span></td>
<td style="padding:8px 0;border-bottom:1px solid #efe7d7;text-align:right;white-space:nowrap">${money(i.lineTotal)}</td></tr>`
    )
    .join('');
  const totals = totalsRows(order)
    .map(([k, v], idx, all) => {
      const last = idx === all.length - 1;
      return `<tr><td style="padding:4px 0;${last ? 'font-weight:bold;font-size:16px;border-top:2px solid #1d2420;padding-top:8px' : 'color:#5b6158'}">${esc(k)}</td><td style="padding:4px 0;text-align:right;${last ? 'font-weight:bold;font-size:16px;border-top:2px solid #1d2420;padding-top:8px' : ''}">${esc(v)}</td></tr>`;
    })
    .join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table><table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:10px">${totals}</table>`;
}

/** Order confirmation for the shopper. */
function customerEmail(order) {
  const c = order.customer || {};
  const f = fulfilment(order);
  const link = `${env.clientUrl}/account?tab=orders`;
  const html = layout(
    `Thank you for your order, ${c.firstName || 'friend'}!`,
    `<p style="margin:0 0 16px">We've received your payment. Your order number is <strong>${esc(order.orderNumber)}</strong>.</p>
${itemsTable(order)}
<div style="margin-top:18px;padding:12px 14px;background:#fbf6ec;border-radius:8px;font-size:14px"><strong>${esc(f.title)}</strong><br>${esc(f.detail)}</div>
<p style="font-size:14px;margin-top:18px">Questions about your order? Just reply to this email.</p>
<p style="font-size:14px"><a href="${esc(link)}" style="color:#1f5135;font-weight:bold">View your orders</a> (if you checked out with an account)</p>`
  );
  const text = [
    `Thank you for your order, ${c.firstName || 'friend'}!`,
    `Order number: ${order.orderNumber}`,
    '',
    ...lines(order).map((l) => l.text),
    '',
    ...totalsRows(order).map(([k, v]) => `${k}: ${v}`),
    '',
    `${f.title}: ${f.detail}`,
    '',
    'Questions? Just reply to this email.',
  ].join('\n');
  return { to: c.email, subject: `Order confirmed — ${order.orderNumber}`, html, text, replyTo: env.storeNotifyEmail || undefined };
}

/** New-order alert for the business. */
function storeEmail(order) {
  const c = order.customer || {};
  const f = fulfilment(order);
  const units = order.items.reduce((s, i) => s + i.quantity, 0);
  const link = `${env.clientUrl}/admin/orders?open=${order._id}`;
  const html = layout(
    `New order ${order.orderNumber} — ${money(order.amountPaid || order.total)}`,
    `<p style="margin:0 0 6px"><strong>${esc(`${c.firstName || ''} ${c.lastName || ''}`.trim())}</strong> · <a href="mailto:${esc(c.email)}">${esc(c.email)}</a> · ${esc(c.phone)}</p>
<p style="margin:0 0 16px;font-size:14px"><strong>${esc(f.title)}:</strong> ${esc(f.detail)}</p>
${itemsTable(order)}
${order.needsReview ? `<p style="margin-top:16px;padding:10px 12px;background:#faefd2;border-radius:8px;font-size:14px"><strong>Needs review:</strong> ${esc(order.reviewReason)}</p>` : ''}
<p style="margin-top:18px"><a href="${esc(link)}" style="display:inline-block;padding:10px 18px;background:#1f5135;color:#fff;border-radius:999px;text-decoration:none;font-weight:bold">Open in the admin dashboard</a></p>`
  );
  const text = [
    `New order ${order.orderNumber} — ${money(order.amountPaid || order.total)} (${units} items)`,
    `Customer: ${`${c.firstName || ''} ${c.lastName || ''}`.trim()} · ${c.email} · ${c.phone}`,
    `${f.title}: ${f.detail}`,
    '',
    ...lines(order).map((l) => l.text),
    '',
    ...totalsRows(order).map(([k, v]) => `${k}: ${v}`),
    order.needsReview ? `\nNEEDS REVIEW: ${order.reviewReason}` : '',
    '',
    `Open it: ${link}`,
  ].join('\n');
  return { to: env.storeNotifyEmail, subject: `New order ${order.orderNumber} — ${money(order.amountPaid || order.total)}`, html, text, replyTo: c.email || undefined };
}

/**
 * Sends the purchase emails for a newly paid order: a confirmation to the shopper and an
 * alert to the business. Claims the order first so Stripe retries or the confirmation-page
 * fallback never send them twice. Never throws — email trouble must not affect payment.
 */
async function sendOrderEmails(order) {
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'paid', emailsSentAt: null },
    { $set: { emailsSentAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!claimed) return { skipped: true };

  const result = { customer: null, store: null };
  const jobs = [];
  if (claimed.customer?.email) jobs.push(['customer', customerEmail(claimed)]);
  if (env.storeNotifyEmail) jobs.push(['store', storeEmail(claimed)]);
  for (const [who, msg] of jobs) {
    try {
      const r = await sendEmail(msg);
      result[who] = r.sent ? 'sent' : 'not-configured';
    } catch (err) {
      result[who] = 'failed';
      console.error(`[email] ${who} email for ${claimed.orderNumber} failed:`, err.message);
    }
  }
  await Order.updateOne({ _id: claimed._id }, { $set: { emailStatus: `customer:${result.customer || 'none'} store:${result.store || 'none'}` } });
  return result;
}

module.exports = { sendOrderEmails, customerEmail, storeEmail };
