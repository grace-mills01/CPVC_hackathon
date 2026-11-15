import test from 'node:test';
import assert from 'node:assert/strict';
import { bestSlots, candidateSlots, countLabel, describeSlot, interestedPeople } from './find-time.js';
import { zonedInstant } from './recommend.js';

const TZ = 'America/Los_Angeles';
const now = new Date(zonedInstant(2026, 11, 16, 8, 0, TZ)); // Mon 8:00 AM
const at = (d, h, mi = 0) => zonedInstant(2026, 11, d, h, mi, TZ);

test('slots run 7 AM–9:30 PM local, every 30 minutes, at least 2 hours out', () => {
  const slots = candidateSlots({ now, days: 1, timeZone: TZ });
  assert.equal(slots[0].start, at(16, 10)); // 8:00 + 2h lead
  assert.ok(slots.every(s => s.end - s.start === 90 * 60000));
  assert.ok(slots.some(s => s.start === at(17, 7)));
  assert.ok(!slots.some(s => s.start === at(16, 22)));
});

test('interest matching: listed interest, word in activity, or close in meaning', () => {
  const people = [
    { id: 'a', interests: ['Basketball'] },
    { id: 'b', interests: ['Running'] },
    { id: 'c', interests: ['Coffee'] },
    { id: 'd', interests: ['Volleyball'] }
  ];
  const activity = { sport: 'Basketball', title: 'Pickup, then running drills', description: '' };
  const out = interestedPeople(people, activity, { similarity: new Map([['d', 0.9], ['c', 0.7]]) });
  assert.deepEqual(out.map(p => p.id), ['a', 'b', 'd']);
});

test('best slots: most free people, host must be free, spread at least 3 hours apart', () => {
  const people = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const busy = new Map([
    ['a', [{ start: at(17, 9), end: at(17, 12) }]],
    ['b', [{ start: at(17, 9), end: at(17, 12) }]],
    ['c', [{ start: at(17, 16, 30), end: at(17, 17, 45) }]]
  ]);
  const slots = [at(17, 10), at(17, 17, 30), at(17, 18, 30), at(18, 18)].map(s => ({ start: s, end: s + 90 * 60000 }));
  const hostBusy = [{ start: at(18, 17), end: at(18, 20) }];
  const picks = bestSlots(slots, people, busy, { hostBusy, limit: 3 });
  // 17:30 (3 free) is within 3 hours of 18:30 (4 free), and the host is busy on the 18th.
  assert.deepEqual(picks.map(p => [p.start, p.free]), [[at(17, 10), 2], [at(17, 18, 30), 4]]);
});

test('counts are hidden when small, so individuals can’t be identified', () => {
  assert.equal(countLabel(1, 2), 'Not enough interested people yet to compare times');
  assert.equal(countLabel(2, 10), 'Fewer than 3 of 10 interested people are free');
  assert.equal(countLabel(9, 12), '9 of 12 interested people are free');
  const d = describeSlot({ start: at(19, 18), free: 2 }, 10, TZ);
  assert.equal(d.free, null);
  assert.equal(d.label, 'Thu, Nov 19, 6:00 PM');
});
