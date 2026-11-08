import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../utils/format';
import { bucketLabel, compactMoney, niceTicks } from '../../utils/reporting';

const HEIGHT = 240;
const M = { top: 12, right: 8, bottom: 28, left: 48 };

/** Column path with a 4px rounded data-end and a square baseline. */
function columnPath(x, y, w, h) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Single-series column chart of revenue per day/month, with a hover + keyboard tooltip.
 * `series` = [{ key: 'YYYY-MM-DD' | 'YYYY-MM', revenue, orders }]
 */
export default function RevenueChart({ series, compact = false, label = 'Gross sales' }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState(null);
  const height = compact ? 160 : HEIGHT;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.max(260, el.clientWidth));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = series.length;
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const max = Math.max(0, ...series.map((d) => d.revenue));
  const ticks = niceTicks(max, compact ? 3 : 4);
  const top = ticks[ticks.length - 1];
  const band = plotW / Math.max(n, 1);
  const gap = band > 4 ? 2 : band > 2 ? 1 : 0;
  const barW = Math.max(1, Math.min(24, band - gap));
  const y = (v) => M.top + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 70))));
  const empty = max === 0;

  const pick = (clientX) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const i = Math.floor((clientX - rect.left - M.left) / band);
    setActive(i >= 0 && i < n ? i : null);
  };

  const onKey = (e) => {
    if (!n) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      setActive((i) => (i === null ? (step > 0 ? 0 : n - 1) : Math.min(n - 1, Math.max(0, i + step))));
    } else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(n - 1);
    else if (e.key === 'Escape') setActive(null);
  };

  const d = active !== null ? series[active] : null;
  const tipLeft = d ? Math.min(Math.max(M.left + band * active + band / 2, 90), width - 90) : 0;

  return (
    <div className="rchart" ref={wrapRef}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label} by ${series[0]?.key.length === 7 ? 'month' : 'day'}. Use the arrow keys to read each value.`}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="rchart__grid" />
            <text x={M.left - 8} y={y(t)} className="rchart__tick" textAnchor="end" dominantBaseline="middle">
              {compactMoney(t)}
            </text>
          </g>
        ))}
        {d && <rect x={M.left + band * active} y={M.top} width={band} height={plotH} className="rchart__hover" />}
        {series.map((pt, i) => {
          const h = (pt.revenue / top) * plotH;
          const x = M.left + band * i + (band - barW) / 2;
          return <path key={pt.key} d={columnPath(x, M.top + plotH - h, barW, h)} className={`rchart__bar ${i === active ? 'is-active' : ''}`} />;
        })}
        <line x1={M.left} x2={width - M.right} y1={M.top + plotH} y2={M.top + plotH} className="rchart__axis" />
        {series.map((pt, i) =>
          i % labelEvery === 0 ? (
            <text key={pt.key} x={M.left + band * i + band / 2} y={height - 8} className="rchart__tick" textAnchor="middle">
              {bucketLabel(pt.key)}
            </text>
          ) : null
        )}
        {empty && (
          <text x={M.left + plotW / 2} y={M.top + plotH / 2} className="rchart__empty" textAnchor="middle">
            No paid sales in this period
          </text>
        )}
      </svg>
      {d && (
        <div className="rchart__tip" style={{ left: tipLeft }} role="status">
          <strong>{formatMoney(d.revenue)}</strong>
          <span>
            {d.orders} {d.orders === 1 ? 'order' : 'orders'}
          </span>
          <span className="muted">{bucketLabel(d.key, { withYear: true })}</span>
        </div>
      )}
    </div>
  );
}
