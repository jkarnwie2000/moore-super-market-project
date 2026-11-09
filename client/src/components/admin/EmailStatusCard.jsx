import { useState } from 'react';
import Icon from '../Icon';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

/** Dashboard card: are purchase emails switched on, where do alerts go, and a test button. */
export default function EmailStatusCard() {
  const { data, error } = useApi('/admin/email');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const { notify } = useToast();

  async function sendTest() {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.post('/admin/email/test');
      setResult({ ok: true, text: r.message });
      notify(r.message);
    } catch (err) {
      setResult({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (error || !data) return null;
  return (
    <section className="card email-card">
      <div className="admin__head">
        <h2>
          <Icon name="mail" size={20} /> Email notifications
        </h2>
        <span className={`badge ${data.enabled ? 'badge--paid' : 'badge--awaiting_payment'}`}>{data.enabled ? 'On' : 'Off'}</span>
      </div>
      {data.enabled ? (
        <>
          <p className="small">
            When an order is paid, the customer gets a confirmation and a new-order alert goes to <strong>{data.notifyTo || '—'}</strong>.
            {data.sender && (
              <span className="muted">
                {' '}
                Sent from {data.sender} ({data.smtpHost}).
              </span>
            )}
          </p>
          <button type="button" className="btn btn--outline btn--sm" onClick={sendTest} disabled={busy}>
            {busy ? 'Sending…' : 'Send test email'}
          </button>
        </>
      ) : (
        <p className="small">
          Purchase emails are switched off. Add <code>SMTP_USER</code> (your Gmail address), <code>SMTP_PASS</code> (a Google app password) and, optionally,{' '}
          <code>STORE_NOTIFY_EMAIL</code> in the hosting settings to turn them on.
        </p>
      )}
      {result && (
        <div className={`alert ${result.ok ? 'alert--info' : 'alert--error'}`} role="status">
          {result.text}
        </div>
      )}
    </section>
  );
}
