const env = require('../config/env');

/**
 * Sends transactional email through Resend's HTTP API (no SDK needed).
 * Without RESEND_API_KEY nothing is sent; outside production the message is printed to the
 * server log instead so the flow can still be tried locally.
 */
async function resendTransport({ to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.emailFrom, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Email provider rejected the message (${res.status}): ${detail.slice(0, 200)}`);
  }
  return { sent: true };
}

async function logTransport({ to, subject, text }) {
  if (!env.isProduction && !env.isTest) console.log(`\n[email not configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
  return { sent: false };
}

let transport = null; // tests can replace it with setEmailTransport()

const emailEnabled = () => Boolean(transport || env.resendApiKey);

async function sendEmail(message) {
  if (transport) return transport(message);
  return env.resendApiKey ? resendTransport(message) : logTransport(message);
}

/** For tests: capture outgoing email instead of sending it. Pass null to restore. */
function setEmailTransport(fn) {
  transport = fn;
}

module.exports = { sendEmail, emailEnabled, setEmailTransport };
