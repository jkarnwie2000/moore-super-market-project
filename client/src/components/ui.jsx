import { Link } from 'react-router-dom';
import Icon from './Icon';

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__ring" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PageLoader({ label }) {
  return (
    <div className="page-loader">
      <Spinner label={label} />
    </div>
  );
}

export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="product-card product-card--skeleton">
          <div className="skeleton skeleton--img" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon = 'box', title, children, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Icon name={icon} size={36} />
      </div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty-state empty-state--error" role="alert">
      <h2>Something went wrong</h2>
      <p>{error?.message || 'We could not load this content.'}</p>
      {onRetry && (
        <button type="button" className="btn btn--outline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Rating({ value = 0, count }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="rating" aria-label={`Rated ${value} out of 5`}>
      <span className="rating__stars" style={{ '--pct': `${pct}%` }} aria-hidden="true">
        ★★★★★
      </span>
      <span className="rating__value">{Number(value).toFixed(1)}</span>
      {count !== undefined && <span className="rating__count">({count})</span>}
    </span>
  );
}

export function QuantitySelector({ value, onChange, max = 99, min = 1, size = 'md', label = 'Quantity' }) {
  return (
    <div className={`qty qty--${size}`} role="group" aria-label={label}>
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(value - 1)} disabled={value <= min}>
        <Icon name="minus" size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
      />
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(value + 1)} disabled={value >= max}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

export function Field({ label, error, children, hint, className = '' }) {
  return (
    <label className={`field ${error ? 'field--error' : ''} ${className}`}>
      <span className="field__label">{label}</span>
      {children}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </label>
  );
}

export function SectionHeader({ eyebrow, title, to, linkLabel = 'View all' }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {to && (
        <Link to={to} className="link-arrow">
          {linkLabel} <Icon name="arrowRight" size={16} />
        </Link>
      )}
    </div>
  );
}

export function StatusBadge({ status }) {
  const labels = {
    awaiting_payment: 'Awaiting payment',
    processing: 'Processing',
    ready_for_pickup: 'Ready for pickup',
    out_for_delivery: 'Out for delivery',
    completed: 'Completed',
    canceled: 'Canceled',
    unpaid: 'Unpaid',
    paid: 'Paid',
    failed: 'Failed',
    expired: 'Expired',
    refunded: 'Refunded',
  };
  return <span className={`badge badge--${status}`}>{labels[status] || status}</span>;
}
