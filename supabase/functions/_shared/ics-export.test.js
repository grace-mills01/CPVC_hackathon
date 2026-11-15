import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar, escapeText, fold, googleCalendarUrl } from './ics-export.js';
import { parseIcsBusyBlocks } from './ics.js';

const game = { id: 'abc', title: 'Pickup, 5v5; all levels', sport: 'Basketball', venue: 'Rec Center, Court 2', starts_at: '2026-11-19T02:00:00Z', description: 'Bring water\nand a friend', status: 'scheduled' };

test('escapes commas, semicolons, backslashes and newlines', () => {
  assert.equal(escapeText('a,b;c\\d\ne'), 'a\\,b\;c\\\\d\\ne');
});

test('folds long lines at 75 bytes without splitting characters', () => {
  const folded = fold('DESCRIPTION:' + 'é'.repeat(60));
  for (const part of folded.split('\r\n')) assert.ok(new TextEncoder().encode(part).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ''), 'DESCRIPTION:' + 'é'.repeat(60));
});

test('builds a valid calendar our own parser can read back', () => {
  const ics = buildCalendar([game, { ...game, id: 'gone', status: 'canceled' }], { siteUrl: 'https://togo.example', now: Date.UTC(2026, 10, 15) });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /UID:abc@togo\r\n/);
  assert.match(ics, /DTSTART:20261119T020000Z\r\nDTEND:20261119T033000Z/);
  assert.match(ics, /SUMMARY:Pickup\\, 5v5\; all levels/);
  assert.match(ics, /STATUS:CANCELLED/);
  const blocks = parseIcsBusyBlocks(ics, { from: new Date('2026-11-15T00:00:00Z') });
  assert.deepEqual(blocks, [{ starts_at: '2026-11-19T02:00:00.000Z', ends_at: '2026-11-19T03:30:00.000Z' }]);
});

test('Google Calendar link carries title, times and place', () => {
  const url = new URL(googleCalendarUrl(game));
  assert.equal(url.origin + url.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(url.searchParams.get('action'), 'TEMPLATE');
  assert.equal(url.searchParams.get('text'), game.title);
  assert.equal(url.searchParams.get('dates'), '20261119T020000Z/20261119T033000Z');
  assert.equal(url.searchParams.get('location'), game.venue);
});
