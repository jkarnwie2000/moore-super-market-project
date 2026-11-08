/**
 * Calendar-date helpers in the store's time zone (no external dependency).
 * Dates are exchanged as 'YYYY-MM-DD' strings; instants are JS Dates (UTC).
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isDateString = (s) => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** 'YYYY-MM-DD' of an instant, as seen on a wall clock in `tz`. */
function localDate(instant, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

/** Milliseconds that `tz` is ahead of UTC at `instant`. */
function tzOffset(instant, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant local midnight starts on `dateStr` in `tz`. */
function startOfLocalDay(dateStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - tzOffset(new Date(guess), tz);
  t = guess - tzOffset(new Date(t), tz); // second pass settles DST transitions
  return new Date(t);
}

/** Adds whole calendar days to a 'YYYY-MM-DD' string. */
function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Inclusive number of calendar days between two 'YYYY-MM-DD' strings. */
function daySpan(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
}

/**
 * Resolves a report period from query params: explicit from/to dates, or a preset
 * ('7d', '30d', '90d', '12m', 'ytd'). Returns local date strings plus the UTC
 * instants [start, end) that bound it.
 */
function resolvePeriod(query, tz, now = new Date()) {
  const today = localDate(now, tz);
  let from;
  let to;
  if (isDateString(query.from) && isDateString(query.to) && query.from <= query.to) {
    from = query.from;
    to = query.to > today ? today : query.to;
    if (from > to) from = to;
  } else {
    to = today;
    const preset = query.range;
    if (preset === '7d') from = addDays(today, -6);
    else if (preset === '90d') from = addDays(today, -89);
    else if (preset === '12m') from = `${addDays(today, -364).slice(0, 7)}-01`;
    else if (preset === 'ytd') from = `${today.slice(0, 4)}-01-01`;
    else from = addDays(today, -29);
  }
  // Cap reports at ~5 years so a typo can't trigger a huge scan.
  if (daySpan(from, to) > 1830) from = addDays(to, -1829);
  return { from, to, start: startOfLocalDay(from, tz), end: startOfLocalDay(addDays(to, 1), tz), days: daySpan(from, to) };
}

module.exports = { isDateString, localDate, startOfLocalDay, addDays, daySpan, resolvePeriod };
