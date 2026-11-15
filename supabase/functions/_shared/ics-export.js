// Builds iCalendar (.ics) text and "add to Google Calendar" links for ToGo
// activities. Plain JavaScript, shared by the app (single-activity downloads)
// and the calendar-feed edge function (subscribed calendars).

const DEFAULT_LENGTH_MS = 90 * 60000;

const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Escapes text per RFC 5545 (backslash, semicolon, comma, newlines). */
export const escapeText = value => String(value ?? '')
  .replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds lines longer than 75 octets, as calendar apps expect. */
export function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) { out.push(current); current = ''; size = 0; }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function activityTimes(game) {
  const start = new Date(game.starts_at).getTime();
  const end = game.ends_at ? new Date(game.ends_at).getTime() : start + DEFAULT_LENGTH_MS;
  return { start, end };
}

function details(game, siteUrl) {
  return [
    `${game.sport} on ToGo`,
    game.description,
    siteUrl ? `Open ToGo: ${siteUrl}` : null
  ].filter(Boolean).join('\n\n');
}

/** One VEVENT block for an activity. */
export function eventLines(game, { siteUrl = '', now = Date.now() } = {}) {
  const { start, end } = activityTimes(game);
  return [
    'BEGIN:VEVENT',
    `UID:${game.id}@togo`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(game.title)}`,
    `LOCATION:${escapeText(game.venue)}`,
    `DESCRIPTION:${escapeText(details(game, siteUrl))}`,
    game.status === 'canceled' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    ...(siteUrl ? [`URL:${siteUrl}`] : []),
    'END:VEVENT'
  ];
}

/** A complete calendar file for one or more activities. */
export function buildCalendar(games, { name = 'ToGo', siteUrl = '', now = Date.now() } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ToGo//Cal Poly activities//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...games.flatMap(g => eventLines(g, { siteUrl, now })),
    'END:VCALENDAR'
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Link that opens Google Calendar with the activity filled in. */
export function googleCalendarUrl(game, { siteUrl = '' } = {}) {
  const { start, end } = activityTimes(game);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: game.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: details(game, siteUrl),
    location: game.venue || ''
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
