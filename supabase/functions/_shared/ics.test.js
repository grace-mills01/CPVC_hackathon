import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFeedUrl, parseIcsBusyBlocks } from './ics.js';

const cal = events => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
const from = new Date('2026-11-16T08:00:00Z'); // Monday 00:00 in Los Angeles

test('reads a UTC event and drops event details', () => {
  const out = parseIcsBusyBlocks(cal(['BEGIN:VEVENT', 'SUMMARY:Secret plans', 'DTSTART:20261117T180000Z', 'DTEND:20261117T190000Z', 'END:VEVENT']), { from });
  assert.deepEqual(out, [{ starts_at: '2026-11-17T18:00:00.000Z', ends_at: '2026-11-17T19:00:00.000Z' }]);
  assert.ok(!JSON.stringify(out).includes('Secret'));
});

test('expands a weekly class with TZID, BYDAY and UNTIL', () => {
  const out = parseIcsBusyBlocks(cal([
    'BEGIN:VEVENT', 'DTSTART;TZID=America/Los_Angeles:20260921T101000', 'DTEND;TZID=America/Los_Angeles:20260921T110000',
    'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261121T235959Z', 'END:VEVENT'
  ]), { from });
  assert.equal(out.length, 3); // Mon 16, Wed 18, Fri 20 — stops after UNTIL
  assert.equal(out[0].starts_at, '2026-11-16T18:10:00.000Z'); // 10:10 PST
});

test('floating times use the user time zone; durations and folded lines work', () => {
  const out = parseIcsBusyBlocks('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20261118T\r\n 140000\r\nDURATION:PT1H30M\r\nEND:VEVENT\r\nEND:VCALENDAR', { from, timeZone: 'America/New_York' });
  assert.deepEqual(out, [{ starts_at: '2026-11-18T19:00:00.000Z', ends_at: '2026-11-18T20:30:00.000Z' }]);
});

test('skips all-day, free, cancelled, and excluded occurrences; merges overlaps', () => {
  const out = parseIcsBusyBlocks(cal([
    'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261117', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART:20261117T200000Z', 'DTEND:20261117T210000Z', 'TRANSP:TRANSPARENT', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART:20261117T220000Z', 'DTEND:20261117T230000Z', 'STATUS:CANCELLED', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART:20261118T170000Z', 'DTEND:20261118T180000Z', 'RRULE:FREQ=DAILY;COUNT=3', 'EXDATE:20261119T170000Z', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART:20261118T173000Z', 'DTEND:20261118T190000Z', 'END:VEVENT'
  ]), { from });
  assert.deepEqual(out.map(b => b.starts_at), ['2026-11-18T17:00:00.000Z', '2026-11-20T17:00:00.000Z']);
  assert.equal(out[0].ends_at, '2026-11-18T19:00:00.000Z');
});

test('only allows Apple, Google and Outlook calendar links', () => {
  assert.deepEqual(checkFeedUrl('webcal://p52-caldav.icloud.com/published/2/abc'), { url: 'https://p52-caldav.icloud.com/published/2/abc', provider: 'apple' });
  assert.equal(checkFeedUrl('https://calendar.google.com/calendar/ical/x/private-y/basic.ics').provider, 'google');
  assert.equal(checkFeedUrl('https://outlook.office365.com/owa/calendar/a/b/calendar.ics').provider, 'outlook');
  assert.ok(checkFeedUrl('https://evil.com/cal.ics').error);
  assert.ok(checkFeedUrl('https://icloud.com.evil.com/x').error);
  assert.ok(checkFeedUrl('http://p52-caldav.icloud.com/x').error);
  assert.ok(checkFeedUrl('https://user:pw@calendar.google.com/x').error);
  assert.ok(checkFeedUrl('not a link').error);
});
