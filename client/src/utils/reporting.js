/** Helpers for the admin sales & inventory reports. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' → 'Nov 7' (or 'Nov 7, 2026' with year); 'YYYY-MM' → 'Nov 2026'. Never shifts by time zone. */
export function bucketLabel(key, { withYear = false } = {}) {
  const [y, m, d] = key.split('-').map(Number);
  if (!d) return `${MONTHS[m - 1]} ${y}`;
  return withYear ? `${MONTHS[m - 1]} ${d}, ${y}` : `${MONTHS[m - 1]} ${d}`;
}

/** Percentage change vs a previous value; null when there is nothing to compare against. */
export function percentChange(current, previous) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Rounds an axis maximum up to a clean value and returns evenly spaced ticks. */
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const rough = max / count;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= rough);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/** Compact money for axis ticks: $0, $250, $1.5K, $12K. */
export function compactMoney(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 || n % 1000 === 0 ? 0 : 1)}K`;
  return `$${Math.round(n)}`;
}

/** Local 'YYYY-MM-DD' for a date input default. */
export function isoDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const REASON_LABELS = {
  sale: 'Online sale',
  in_store_sale: 'In-store sale',
  restock: 'Restock',
  adjustment: 'Adjustment',
  damaged: 'Damaged / expired',
  returned: 'Customer return',
  order_canceled: 'Order cancelled',
  refunded: 'Refunded',
  order_deleted: 'Sale deleted',
};
