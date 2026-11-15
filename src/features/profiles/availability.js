// Turns the two availability sources into busy blocks the matcher understands:
// 1. Google Calendar free/busy (already instants), and
// 2. weekly busy times entered by hand (expanded into dated blocks here).

export const WEEKDAY_LABELS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

const DAY_MS = 86400000;

function atLocalTime(date, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Expands weekly entries ({weekday, start_time 'HH:MM', end_time}) into concrete
 * busy blocks in the viewer's local time over the next `days` days.
 */
export function expandWeeklyBusy(entries = [], { from = new Date(), days = 28 } = {}) {
  const blocks = [];
  const first = new Date(from);
  first.setHours(0, 0, 0, 0);
  for (let i = 0; i <= days; i++) {
    const day = new Date(first.getTime() + i * DAY_MS + 3 * 3600000); // +3h steps safely past DST shifts
    for (const e of entries) {
      if (e.weekday !== day.getDay()) continue;
      const s = atLocalTime(day, e.start_time.slice(0, 5));
      const end = atLocalTime(day, e.end_time.slice(0, 5));
      if (end > s && end > from) blocks.push({ starts_at: s.toISOString(), ends_at: end.toISOString() });
    }
  }
  return blocks.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** Validates one manual entry from the form; returns an error message or ''. */
export function validateWeeklyEntry({ weekdays, start_time, end_time }) {
  if (!weekdays?.length) return 'Pick at least one day.';
  if (!start_time || !end_time) return 'Add a start and end time.';
  if (end_time <= start_time) return 'End time must be after the start time.';
  return '';
}

export const GOOGLE_FREEBUSY_SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy';

/**
 * Reads busy times from the user's primary Google Calendar. Needs the OAuth
 * access token Supabase returns right after Google sign-in (session.provider_token).
 */
export async function fetchGoogleBusy(accessToken, { from = new Date(), days = 28, fetchImpl = fetch } = {}) {
  const response = await fetchImpl('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: from.toISOString(),
      timeMax: new Date(from.getTime() + days * DAY_MS).toISOString(),
      items: [{ id: 'primary' }]
    })
  });
  if (!response.ok) throw new Error('Couldn’t read your Google Calendar. Try connecting again.');
  const data = await response.json();
  const calendar = data.calendars?.primary;
  if (calendar?.errors?.length) throw new Error('Google Calendar didn’t share your availability.');
  return (calendar?.busy || []).map(b => ({ starts_at: new Date(b.start).toISOString(), ends_at: new Date(b.end).toISOString() }));
}

/**
 * Turns a one-time form entry ({date 'YYYY-MM-DD', start_time, end_time}) into a
 * busy block in local time. Returns {block} or {error}.
 */
export function oneOffBlock({ date, start_time, end_time }, now = new Date()) {
  if (!date || !start_time || !end_time) return { error: 'Add a date, start time, and end time.' };
  if (end_time <= start_time) return { error: 'End time must be after the start time.' };
  const [y, m, d] = date.split('-').map(Number);
  const at = t => { const [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, d, h, mi); };
  const start = at(start_time), end = at(end_time);
  if (end <= now) return { error: 'That time has already passed.' };
  return { block: { starts_at: start.toISOString(), ends_at: end.toISOString() } };
}
