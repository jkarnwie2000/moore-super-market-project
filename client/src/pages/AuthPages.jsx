import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { EMAIL_RE } from '../utils/checkoutValidation';
import { api } from '../services/api';

/** Only allow internal redirect targets after login (prevents open redirects). */
const safeNext = (next) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <div className="auth__panel">
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
        <p className="auth__footer">{footer}</p>
      </div>
      <div className="auth__art" aria-hidden="true">
        <div className="kente-band kente-band--vertical" />
        <blockquote>
          “The jollof tastes like home — and my jerk chicken has never been better.”
          <cite>— Moore Supermarket customers</cite>
        </blockquote>
      </div>
    </div>
  );
}

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const next = safeNext(params.get('next'));
  // Staff go straight to the dashboard unless they were sent here from a specific page.
  const destination = (u) => (u?.role === 'admin' && !params.get('next') ? '/admin' : next);

  if (user) return <Navigate to={destination(user)} replace />;

  async function submit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(form.email) || !form.password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const signedIn = await login(form.email, form.password);
      navigate(destination(signedIn), { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to view your orders, saved addresses and check out faster."
      footer={
        <>
          New to Moore Supermarket? <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}
        <Field label="Email address">
          <input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password">
          <input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Link to={`/forgot-password${EMAIL_RE.test(form.email) ? `?email=${encodeURIComponent(form.email)}` : ''}`} className="auth__forgot">
          Forgot password?
        </Link>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  useDocumentTitle('Create account');
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const next = safeNext(params.get('next'));

  if (user) return <Navigate to={next} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (form.name.trim().length < 2) found.name = 'Please enter your full name.';
    if (!EMAIL_RE.test(form.email)) found.email = 'Please enter a valid email address.';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      found.password = 'Use at least 8 characters with a letter and a number.';
    }
    if (form.password !== form.confirm) found.confirm = 'Passwords do not match.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setLoading(true);
    setError('');
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      navigate(next, { replace: true });
    } catch (err) {
      setErrors(err.errors || {});
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Track orders, save delivery addresses and enjoy faster checkout."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}
        <Field label="Full name" error={errors.name}>
          <input autoComplete="name" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email address" error={errors.email}>
          <input type="email" autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters, including a letter and a number.">
          <input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          <input type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        </Field>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  useDocumentTitle('Forgot password');
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(null); // { message, emailEnabled }

  async function submit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setSent(await api.post('/auth/forgot-password', { email }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the email you sign in with and we'll send you a link to choose a new password."
      footer={
        <>
          Remembered it? <Link to="/login">Back to sign in</Link>
        </>
      }
    >
      {sent ? (
        <div className="stack">
          <div className="alert alert--info" role="status">
            <span>
              <strong>Check your inbox.</strong> {sent.message} If it doesn't arrive in a few minutes, check your spam folder.
            </span>
          </div>
          {!sent.emailEnabled && (
            <div className="alert alert--warning" role="alert">
              <span>Email sending isn't set up on this store yet, so the reset email can't be delivered. Please contact the store owner.</span>
            </div>
          )}
          <button type="button" className="link-btn" onClick={() => setSent(null)}>
            Use a different email
          </button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {error && (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          )}
          <Field label="Email address">
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Keep the token in memory and remove it from the address bar (and browser history).
  const [token] = useState(() => params.get('token') || '');
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (params.get('token')) window.history.replaceState(null, '', '/reset-password');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      found.password = 'Use at least 8 characters with a letter and a number.';
    }
    if (form.password !== form.confirm) found.confirm = 'Passwords do not match.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setLoading(true);
    setError('');
    try {
      const { user } = await api.post('/auth/reset-password', { token, password: form.password });
      setUser(user);
      navigate(user.role === 'admin' ? '/admin' : '/account', { replace: true, state: { passwordChanged: true } });
    } catch (err) {
      setErrors(err.errors || {});
      setError(err.message);
      setLoading(false);
    }
  }

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <AuthShell title="Reset link not valid" subtitle="This link is incomplete or has already been used." footer={<Link to="/login">Back to sign in</Link>}>
        <Link to="/forgot-password" className="btn btn--primary btn--lg btn--block">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick something you haven't used here before. You'll be signed in once it's saved, and signed out everywhere else."
      footer={<Link to="/login">Back to sign in</Link>}
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error && (
          <div className="alert alert--error" role="alert">
            <span>
              {error} {/expired|invalid/i.test(error) && <Link to="/forgot-password">Request a new link</Link>}
            </span>
          </div>
        )}
        <Field label="New password" error={errors.password} hint="At least 8 characters, including a letter and a number.">
          <input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoFocus />
        </Field>
        <Field label="Confirm new password" error={errors.confirm}>
          <input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={loading}>
          {loading ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthShell>
  );
}
