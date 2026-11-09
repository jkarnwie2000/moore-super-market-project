const nodemailer = require('nodemailer');
const env = require('../config/env');

/**
 * Sends email. Preferred: SMTP through an ordinary mailbox (Gmail by default — no domain
 * needed). Optional: Resend's HTTP API. With neither configured nothing is sent; outside
 * production the message is printed to the server log so the flows can be tried locally.
 */

let smtp = null;
function smtpTransport() {
  if (!smtp) {
    smtp = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465, // 465 = TLS from the start; 587 = STARTTLS
      auth: { user: env.smtpUser, pass: env.smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return smtp;
}

const fromAddress = () => env.emailFrom || `"${env.emailFromName.replace(/"/g, '')}" <${env.smtpUser}>`;

async function sendViaSmtp({ to, subject, html, text, replyTo }) {
  const info = await smtpTransport().sendMail({ from: fromAddress(), to, subject, html, text, replyTo });
  return { sent: true, id: info.messageId };
}

async function sendViaResend({ to, subject, html, text, replyTo }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.emailFrom || 'Moore Supermarket <onboarding@resend.dev>', to: [to], subject, html, text, reply_to: replyTo }),
  });
  if (!res.ok) throw new Error(`Email provider rejected the message (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return { sent: true };
}

async function logOnly({ to, subject, text }) {
  if (!env.isProduction && !env.isTest) console.log(`\n[email not configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
  return { sent: false };
}

let override = null; // tests capture mail with setEmailTransport()

const smtpConfigured = () => Boolean(env.smtpUser && env.smtpPass);
const emailEnabled = () => Boolean(override || smtpConfigured() || env.resendApiKey);

async function sendEmail(message) {
  if (override) return override(message);
  if (smtpConfigured()) return sendViaSmtp(message);
  if (env.resendApiKey) return sendViaResend(message);
  return logOnly(message);
}

/** For tests: capture outgoing email instead of sending it. Pass null to restore. */
function setEmailTransport(fn) {
  override = fn;
}

/** Checks the SMTP login without sending anything (used by the admin "test email" check). */
async function verifySmtp() {
  if (!smtpConfigured()) return { ok: false, reason: 'SMTP_USER and SMTP_PASS are not set.' };
  try {
    await smtpTransport().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { sendEmail, emailEnabled, setEmailTransport, verifySmtp };
