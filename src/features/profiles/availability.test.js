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

test('Google free/busy response becomes busy blocks', async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    sent = { url, init };
    return { ok: true, json: async () => ({ calendars: { primary: { busy: [{ start: '2026-11-17T18:00:00Z', end: '2026-11-17T19:00:00Z' }] } } }) };
  };
  const blocks = await fetchGoogleBusy('token-123', { from: new Date('2026-11-16T00:00:00Z'), fetchImpl });
  assert.equal(sent.init.headers.Authorization, 'Bearer token-123');
  assert.deepEqual(JSON.parse(sent.init.body).items, [{ id: 'primary' }]);
  assert.deepEqual(blocks, [{ starts_at: '2026-11-17T18:00:00.000Z', ends_at: '2026-11-17T19:00:00.000Z' }]);
});

test('Google errors surface a friendly message', async () => {
  await assert.rejects(fetchGoogleBusy('x', { fetchImpl: async () => ({ ok: false }) }), /Google Calendar/);
});
