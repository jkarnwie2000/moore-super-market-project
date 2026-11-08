import { describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { toCsv } from '../utils/csv';
import { bucketLabel, compactMoney, niceTicks, percentChange } from '../utils/reporting';
import RevenueChart from '../components/admin/RevenueChart';

describe('CSV export', () => {
  test('quotes commas, quotes and newlines, and neutralises spreadsheet formulas', () => {
    const csv = toCsv(
      [
        { label: 'Name', value: (r) => r.name },
        { label: 'Total', value: (r) => r.total },
      ],
      [
        { name: 'Ackee, canned', total: 12.99 },
        { name: 'Say "hi"\nthere', total: 0 },
        { name: '=HYPERLINK("http://x")', total: -5 },
      ]
    );
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Name,Total');
    expect(lines[1]).toBe('"Ackee, canned",12.99');
    expect(lines[2]).toBe('"Say ""hi""\nthere",0');
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")",-5`);
  });
});

describe('Report helpers', () => {
  test('labels days and months without time-zone drift', () => {
    expect(bucketLabel('2026-11-01')).toBe('Nov 1');
    expect(bucketLabel('2026-01-31', { withYear: true })).toBe('Jan 31, 2026');
    expect(bucketLabel('2026-12')).toBe('Dec 2026');
  });

  test('percent change handles zero baselines', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
  });

  test('axis ticks are clean round numbers covering the max', () => {
    expect(niceTicks(87)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(0)).toEqual([0, 1]);
    const t = niceTicks(1234);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(1234);
    expect(compactMoney(2500)).toBe('$2.5K');
    expect(compactMoney(20000)).toBe('$20K');
    expect(compactMoney(75)).toBe('$75');
  });
});

describe('RevenueChart', () => {
  const series = [
    { key: '2026-11-05', revenue: 0, orders: 0 },
    { key: '2026-11-06', revenue: 46.46, orders: 2 },
    { key: '2026-11-07', revenue: 23.38, orders: 1 },
  ];

  test('draws one column per bucket and reads values with the keyboard', () => {
    const { container } = render(<RevenueChart series={series} />);
    expect(container.querySelectorAll('.rchart__bar')).toHaveLength(3);
    const chart = screen.getByRole('img');
    fireEvent.keyDown(chart, { key: 'End' });
    expect(screen.getByRole('status').textContent).toContain('$23.38');
    expect(screen.getByRole('status').textContent).toContain('1 order');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(screen.getByRole('status').textContent).toContain('$46.46');
    expect(screen.getByRole('status').textContent).toContain('Nov 6, 2026');
  });

  test('shows an empty message when there are no sales', () => {
    render(<RevenueChart series={series.map((s) => ({ ...s, revenue: 0, orders: 0 }))} />);
    expect(screen.getByText('No paid sales in this period')).toBeTruthy();
  });
});
