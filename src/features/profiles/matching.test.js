import test from 'node:test';
import assert from 'node:assert/strict';
import { conflictsWithBusy, rankActivities, scoreActivity } from './matching.js';

const now = new Date('2026-11-16T08:00:00Z');
const at = h => new Date(now.getTime() + h * 3600000).toISOString();
const game = (over = {}) => ({ id: 'g1', host_id: 'host', sport: 'Basketball', title: 'Pickup', description: '', venue: 'Rec Center', starts_at: at(24), capacity: 10, status: 'scheduled', ...over });
const user = { id: 'me', interests: ['Basketball', 'Coffee', 'Running'], goals: ['stay_active', 'meet_people'] };

test('matching interest ranks above an unrelated activity', () => {
  const ranked = rankActivities([game({ id: 'a', sport: 'Swimming' }), game({ id: 'b' })], { ...user, goals: [] }, { now });
  assert.deepEqual(ranked.map(m => m.game.id), ['b']);
  assert.match(ranked[0].reasons[0], /basketball/);
});

test('activities that overlap a busy block are excluded', () => {
  const busy = [{ starts_at: at(24), ends_at: at(25) }];
  const m = scoreActivity(game(), user, { busyBlocks: busy, now });
  assert.equal(m.eligible, false);
  assert.equal(m.fitsSchedule, false);
});

test('free time adds a schedule reason', () => {
  const busy = [{ starts_at: at(2), ends_at: at(3) }];
  const m = scoreActivity(game(), user, { busyBlocks: busy, now });
  assert.equal(m.eligible, true);
  assert.equal(m.reasons[0], 'Fits your schedule');
});

test('travel buffer catches back-to-back conflicts', () => {
  const start = new Date(at(24)).getTime();
  assert.equal(conflictsWithBusy(start, start + 3600000, [{ starts_at: at(23), ends_at: new Date(start - 5 * 60000).toISOString() }]), true);
  assert.equal(conflictsWithBusy(start, start + 3600000, [{ starts_at: at(22), ends_at: at(23) }]), false);
});

test('full, past, joined, hosted and canceled activities are never suggested', () => {
  const roster = Array.from({ length: 10 }, (_, i) => ({ game_id: 'full', user_id: `u${i}` })).concat({ game_id: 'joined', user_id: 'me' });
  const ranked = rankActivities([
    game({ id: 'full' }), game({ id: 'past', starts_at: at(-1) }), game({ id: 'joined' }),
    game({ id: 'mine', host_id: 'me' }), game({ id: 'off', status: 'canceled' }), game({ id: 'ok' })
  ], user, { roster, now });
  assert.deepEqual(ranked.map(m => m.game.id), ['ok']);
});

test('study goal surfaces study groups', () => {
  const m = scoreActivity(game({ sport: 'Study group', title: 'CPE 133 study session' }), { id: 'me', interests: [], goals: ['study'] }, { now });
  assert.equal(m.eligible, true);
  assert.ok(m.reasons.includes('Study with others'));
});
