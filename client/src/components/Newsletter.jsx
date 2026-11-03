import { useState } from 'react';
import Icon from './Icon';
import { api } from '../services/api';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ state: 'idle', message: '' });

  async function submit(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setStatus({ state: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    setStatus({ state: 'loading', message: '' });
    try {
      const res = await api.post('/newsletter', { email: email.trim() });
      setStatus({ state: 'success', message: res.message });
      setEmail('');
    } catch (err) {
      setStatus({ state: 'error', message: err.message });
    }
  }

  return (
    <section className="newsletter">
      <div className="container newsletter__inner">
        <div>
          <p className="eyebrow eyebrow--gold">Join the Moore family</p>
          <h2>Get weekly deals, new arrivals &amp; recipes</h2>
          <p>Be the first to know when fresh yam, breadfruit and seasonal sorrel land in store. No spam — unsubscribe anytime.</p>
        </div>
        <form className="newsletter__form" onSubmit={submit} noValidate>
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <div className="newsletter__field">
            <Icon name="mail" size={18} />
            <input id="newsletter-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" className="btn btn--gold" disabled={status.state === 'loading'}>
            {status.state === 'loading' ? 'Subscribing…' : 'Subscribe'}
          </button>
          {status.message && (
            <p className={`newsletter__msg newsletter__msg--${status.state}`} role="status">
              {status.message}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
