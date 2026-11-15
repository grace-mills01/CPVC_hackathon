import test from 'node:test';
import assert from 'node:assert/strict';
import { expandWeeklyBusy, fetchGoogleBusy, validateWeeklyEntry } from './availability.js';

test('weekly entries expand onto matching weekdays in local time', () => {
  const from = new Date(2026, 10, 16, 0, 0); // Monday, local time
  const blocks = expandWeeklyBusy([{ weekday: 1, start_time: '10:00', end_time: '11:00' }, { weekday: 3, start_time: '14:10:00', end_time: '15:00:00' }], { from, days: 13 });
  assert.equal(blocks.length, 4);
  const first = new Date(blocks[0].starts_at);
  assert.equal(first.getDay(), 1);
  assert.equal(first.getHours(), 10);
  assert.equal(new Date(blocks[1].starts_at).getDay(), 3);
  assert.equal(new Date(blocks[1].starts_at).getMinutes(), 10);
});

test('blocks that already ended today are dropped', () => {
  const from = new Date(2026, 10, 16, 12, 0);
  const blocks = expandWeeklyBusy([{ weekday: 1, start_time: '09:00', end_time: '10:00' }], { from, days: 6 });
  assert.equal(blocks.length, 0);
});

test('manual entry validation', () => {
  assert.match(validateWeeklyEntry({ weekdays: [], start_time: '10:00', end_time: '11:00' }), /day/);
  assert.match(validateWeeklyEntry({ weekdays: [1], start_time: '11:00', end_time: '10:00' }), /after/);
  assert.equal(validateWeeklyEntry({ weekdays: [1], start_time: '10:00', end_time: '11:00' }), '');
});

function googleMock({ list, busy, listOk = true }) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.includes('/calendarList')) return { ok: listOk, json: async () => ({ items: list }) };
    const ids = JSON.parse(init.body).items.map(i => i.id);
    return { ok: true, json: async () => ({ calendars: Object.fromEntries(ids.map(id => [id, busy[id] || { busy: [] }])) }) };
  };
  return { fetchImpl, calls };
}

test('Google sync checks every visible calendar and merges their busy times', async () => {
  const { fetchImpl, calls } = googleMock({
    list: [
      { id: 'mel@gmail.com', primary: true, selected: true },
      { id: 'classes123@group.calendar.google.com', selected: true },
      { id: 'hidden@group.calendar.google.com', selected: false },
      { id: 'en.usa#holiday@group.v.calendar.google.com', selected: true }
    ],
    busy: {
      primary: { busy: [{ start: '2026-11-17T18:00:00Z', end: '2026-11-17T19:00:00Z' }] },
      'classes123@group.calendar.google.com': { busy: [{ start: '2026-11-17T18:30:00Z', end: '2026-11-17T20:00:00Z' }, { start: '2026-11-18T17:00:00Z', end: '2026-11-18T18:00:00Z' }] }
    }
  });
  const { blocks, calendars } = await fetchGoogleBusy('token-123', { from: new Date('2026-11-16T00:00:00Z'), fetchImpl });
  const freeBusy = calls.find(c => c.url.endsWith('/freeBusy'));
  assert.equal(freeBusy.init.headers.Authorization, 'Bearer token-123');
  assert.deepEqual(JSON.parse(freeBusy.init.body).items, [{ id: 'primary' }, { id: 'classes123@group.calendar.google.com' }]);
  assert.equal(calendars, 2);
  assert.deepEqual(blocks, [
    { starts_at: '2026-11-17T18:00:00.000Z', ends_at: '2026-11-17T20:00:00.000Z' },
    { starts_at: '2026-11-18T17:00:00.000Z', ends_at: '2026-11-18T18:00:00.000Z' }
  ]);
});

test('Google sync falls back to the main calendar without list permission', async () => {
  const { fetchImpl, calls } = googleMock({ listOk: false, busy: { primary: { busy: [] } } });
  const { blocks, calendars } = await fetchGoogleBusy('t', { fetchImpl });
  assert.deepEqual(JSON.parse(calls[1].init.body).items, [{ id: 'primary' }]);
  assert.equal(calendars, 1);
  assert.deepEqual(blocks, []);
});

test('Google errors surface a friendly message', async () => {
  await assert.rejects(fetchGoogleBusy('x', { fetchImpl: async url => url.includes('calendarList') ? { ok: false } : { ok: false } }), /Google Calendar/);
});

test('one-time blocks use local time and reject bad input', async () => {
  const { oneOffBlock } = await import('./availability.js');
  const now = new Date(2026, 10, 16, 9, 0);
  const { block } = oneOffBlock({ date: '2026-11-20', start_time: '14:00', end_time: '17:00' }, now);
  assert.equal(new Date(block.starts_at).getHours(), 14);
  assert.equal(new Date(block.ends_at).getDate(), 20);
  assert.match(oneOffBlock({ date: '2026-11-20', start_time: '17:00', end_time: '14:00' }, now).error, /after/);
  assert.match(oneOffBlock({ date: '2026-11-15', start_time: '10:00', end_time: '11:00' }, now).error, /passed/);
  assert.match(oneOffBlock({ date: '', start_time: '10:00', end_time: '11:00' }, now).error, /date/);
});
