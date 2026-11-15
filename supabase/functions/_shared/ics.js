// Minimal iCalendar (.ics) reader that turns a calendar feed into busy time
// blocks. It keeps only start/end instants, never titles or descriptions.
// Plain JavaScript with no imports, so it runs in Deno (edge function) and Node (tests).
//
// Supports: timed events in UTC, with TZID, or floating (local) time; DTEND or
// DURATION; DAILY/WEEKLY RRULEs with INTERVAL, COUNT, UNTIL, BYDAY; EXDATE.
// Skips: all-day events, cancelled events, and events marked "free"
// (TRANSP:TRANSPARENT), since those usually don't block someone's time.

const DAY_MS = 86400000;
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseLine(line) {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(';');
  const params = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1).trim() };
}

function tzOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(utcMs));
  const v = Object.fromEntries(parts.map(p => [p.type, Number(p.value)]));
  return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - utcMs;
}

/** Wall-clock time → epoch ms. Floating times use `fallbackTz` (the user's zone). */
function toInstant(w, fallbackTz) {
  const naive = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  if (w.kind === 'utc') return naive;
  const zone = w.kind === 'tz' ? w.tz : fallbackTz;
  try {
    let guess = naive - tzOffsetMs(naive, zone);
    guess = naive - tzOffsetMs(guess, zone);
    return guess;
  } catch {
    // Unknown zone name (e.g. a Windows zone from Outlook): try the fallback.
    if (zone !== fallbackTz) return toInstant({ ...w, kind: 'floating' }, fallbackTz);
    return naive;
  }
}

function parseDate(prop) {
  if (!prop) return null;
  const m = prop.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const allDay = prop.params.VALUE === 'DATE' || m[4] === undefined;
  return {
    y: +m[1], m: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0), allDay,
    kind: m[7] ? 'utc' : prop.params.TZID ? 'tz' : 'floating', tz: prop.params.TZID
  };
}

function parseDuration(value) {
  const m = value?.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const ms = ((+(m[2] || 0) * 7 + +(m[3] || 0)) * 24 * 3600 + +(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) * 1000;
  return m[1] === '-' ? -ms : ms;
}

function addDays(w, days) {
  const t = new Date(Date.UTC(w.y, w.m - 1, w.d + days));
  return { ...w, y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const dayNumber = w => Math.floor(Date.UTC(w.y, w.m - 1, w.d) / DAY_MS);
const weekday = w => new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay();

function parseRule(value) {
  const rule = Object.fromEntries(value.split(';').map(p => p.split('=')).map(([k, v]) => [k.toUpperCase(), v]));
  return {
    freq: rule.FREQ,
    interval: Math.max(1, +(rule.INTERVAL || 1)),
    count: rule.COUNT ? +rule.COUNT : Infinity,
    until: rule.UNTIL ? parseDate({ value: rule.UNTIL, params: {} }) : null,
    byDay: rule.BYDAY ? rule.BYDAY.split(',').map(d => WEEKDAYS.indexOf(d.slice(-2))).filter(d => d >= 0) : null
  };
}

/** Yields each occurrence's start wall time, in order, starting with DTSTART. */
function* occurrences(start, rule, tz) {
  if (!rule || !['DAILY', 'WEEKLY'].includes(rule.freq)) { yield start; return; }
  const untilMs = rule.until ? toInstant(rule.until.allDay ? { ...rule.until, h: 23, mi: 59, s: 59 } : rule.until, tz) : Infinity;
  const startWeek = Math.floor((dayNumber(start) + 4) / 7); // Sunday-start weeks (epoch day 0 was a Thursday)
  const byDay = rule.freq === 'WEEKLY' ? (rule.byDay?.length ? rule.byDay : [weekday(start)]) : null;
  let emitted = 0;
  for (let i = 0; i < 3660 && emitted < rule.count; i++) {
    const w = addDays(start, i);
    if (toInstant(w, tz) > untilMs) return;
    const keep = rule.freq === 'DAILY'
      ? i % rule.interval === 0
      : byDay.includes(weekday(w)) && (Math.floor((dayNumber(w) + 4) / 7) - startWeek) % rule.interval === 0;
    if (keep) { emitted++; yield w; }
  }
}

/**
 * @param {string} text  Contents of an .ics feed.
 * @param {{from?: Date, days?: number, timeZone?: string}} [options]
 *   Window to keep (default: next 30 days) and the zone for floating times.
 * @returns {{starts_at: string, ends_at: string}[]}  Merged, sorted busy blocks.
 */
export function parseIcsBusyBlocks(text, { from = new Date(), days = 30, timeZone = 'America/Los_Angeles' } = {}) {
  const windowStart = from.getTime();
  const windowEnd = windowStart + days * DAY_MS;
  const blocks = [];
  let event = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { event = { exdates: new Set() }; continue; }
    if (line === 'END:VEVENT') { if (event) collect(event); event = null; continue; }
    if (!event) continue;
    const prop = parseLine(line);
    if (!prop) continue;
    if (prop.name === 'EXDATE') {
      for (const value of prop.value.split(',')) {
        const w = parseDate({ value, params: prop.params });
        if (w) event.exdates.add(toInstant(w, timeZone));
      }
    } else {
      event[prop.name] = prop;
    }
  }

  function collect(e) {
    if (e.STATUS?.value.toUpperCase() === 'CANCELLED' || e.TRANSP?.value.toUpperCase() === 'TRANSPARENT') return;
    if (e['RECURRENCE-ID']) return; // moved single instance of a series; the series already covers that week
    const start = parseDate(e.DTSTART);
    if (!start || start.allDay) return;
    const end = parseDate(e.DTEND);
    const length = end ? toInstant(end, timeZone) - toInstant(start, timeZone) : parseDuration(e.DURATION?.value) ?? 3600000;
    if (!(length > 0) || length > 2 * DAY_MS) return;
    for (const w of occurrences(start, e.RRULE ? parseRule(e.RRULE.value) : null, timeZone)) {
      const s = toInstant(w, timeZone);
      if (s >= windowEnd) break;
      if (s + length <= windowStart || e.exdates.has(s)) continue;
      blocks.push([s, s + length]);
    }
  }

  blocks.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of blocks) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged.slice(0, 1000).map(([s, e]) => ({ starts_at: new Date(s).toISOString(), ends_at: new Date(e).toISOString() }));
}

// Hosts allowed for calendar links. Limiting hosts keeps the sync function from
// being used to fetch arbitrary URLs.
const FEED_HOSTS = [
  { provider: 'apple', test: h => h === 'icloud.com' || h.endsWith('.icloud.com') },
  { provider: 'google', test: h => h === 'calendar.google.com' },
  { provider: 'outlook', test: h => ['outlook.live.com', 'outlook.office365.com', 'outlook.office.com'].includes(h) }
];

/** Normalizes a pasted calendar link. Returns {url, provider} or {error}. */
export function checkFeedUrl(raw) {
  let url;
  try { url = new URL(String(raw || '').trim().replace(/^webcals?:\/\//i, 'https://')); }
  catch { return { error: 'That doesn’t look like a link. Paste the full calendar link.' }; }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    return { error: 'Calendar links must start with https:// or webcal://.' };
  }
  const match = FEED_HOSTS.find(f => f.test(url.hostname.toLowerCase()));
  if (!match) return { error: 'Use a link from Apple (iCloud), Google Calendar, or Outlook.' };
  return { url: url.toString(), provider: match.provider };
}
