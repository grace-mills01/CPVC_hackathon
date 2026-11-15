import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activityText, buildPrompt, cosine, eligibleActivities, expandWeekly, fallbackReason,
  notificationsFor, parsePicks, profileText, scheduleContext, scoreCandidate, toBlocks, zonedInstant
} from './recommend.js';

const TZ = 'America/Los_Angeles';
const now = new Date('2026-11-16T16:00:00Z'); // Mon 8:00 AM in SLO
const at = (d, h, mi = 0) => new Date(zonedInstant(2026, 11, d, h, mi, TZ)).toISOString();
const game = over => ({ id: 'g', host_id: 'host', sport: 'Basketball', title: 'Pickup', description: '', venue: 'Rec Center', starts_at: at(19, 16), capacity: 10, status: 'scheduled', ...over });
const mel = { id: 'me', display_name: 'Mel Ho', interests: ['Basketball', 'Running', 'Coffee'], goals: ['meet_people', 'unwind'] };

test('zonedInstant handles daylight saving time', () => {
  assert.equal(new Date(zonedInstant(2026, 11, 16, 8, 0, TZ)).toISOString(), '2026-11-16T16:00:00.000Z'); // PST
  assert.equal(new Date(zonedInstant(2026, 7, 1, 8, 0, TZ)).toISOString(), '2026-07-01T15:00:00.000Z'); // PDT
});

test('weekly entries expand on the right local weekdays', () => {
  const blocks = expandWeekly([{ weekday: 4, start_time: '13:10:00', end_time: '14:30:00', label: 'PHYS 132' }], { from: now, days: 7, timeZone: TZ });
  assert.equal(blocks.length, 1);
  assert.equal(new Date(blocks[0].start).toISOString(), at(19, 13, 10));
  assert.equal(blocks[0].label, 'PHYS 132');
});

test('eligibility drops full, joined, hosted, dismissed, past, far-off and clashing activities', () => {
  const busy = toBlocks([{ starts_at: at(19, 15), ends_at: at(19, 16, 30) }]);
  const roster = [...Array(4)].map((_, i) => ({ game_id: 'full', user_id: `u${i}` })).concat({ game_id: 'joined', user_id: 'me' });
  const games = [
    game({ id: 'ok', starts_at: at(20, 18) }),
    game({ id: 'clash' }),
    game({ id: 'full', capacity: 4, starts_at: at(20, 18) }),
    game({ id: 'joined', starts_at: at(20, 18) }),
    game({ id: 'mine', host_id: 'me', starts_at: at(20, 18) }),
    game({ id: 'nope', starts_at: at(20, 18) }),
    game({ id: 'past', starts_at: at(15, 18) }),
    game({ id: 'far', starts_at: '2027-02-01T18:00:00Z' }),
    game({ id: 'canceled', status: 'canceled', starts_at: at(20, 18) })
  ];
  const out = eligibleActivities(games, { userId: 'me', roster, dismissed: new Set(['nope']), busy, now });
  assert.deepEqual(out.map(c => c.game.id), ['ok']);
  assert.equal(out[0].openSpots, 10);
});

test('scoring rewards meaning, interests, and goals', () => {
  const base = { openSpots: 6, start: new Date(at(19, 16)).getTime() };
  const hoops = scoreCandidate({ ...base, game: game() }, mel, 0.86, now);
  const chill = scoreCandidate({ ...base, game: game({ sport: 'Beach volleyball', title: 'Sunset beach volleyball', description: 'Chill, all levels' }) }, mel, 0.84, now);
  const unrelated = scoreCandidate({ ...base, game: game({ sport: 'Climbing', title: 'Bouldering night' }) }, mel, 0.74, now);
  assert.ok(hoops.score > unrelated.score);
  assert.ok(chill.score > unrelated.score);
  assert.ok(hoops.signals.includes('you’re into basketball'));
  assert.ok(chill.signals.includes('it’s a relaxed way to unwind'));
});

test('schedule context names the class right before an activity', () => {
  const busy = expandWeekly([{ weekday: 4, start_time: '13:10', end_time: '14:30', label: 'PHYS 132' }], { from: now, days: 7, timeZone: TZ });
  const c = { start: new Date(at(19, 16)).getTime(), end: new Date(at(19, 17, 30)).getTime() };
  assert.deepEqual(scheduleContext(c, busy, TZ), { when: 'Thu, Nov 19, 4:00 PM', note: 'after your PHYS 132 (ends 2:30 PM)', text: 'Thu, Nov 19, 4:00 PM, after your PHYS 132 (ends 2:30 PM)' });
  assert.deepEqual(scheduleContext(c, [], TZ), { when: 'Thu, Nov 19, 4:00 PM', note: '', text: 'Thu, Nov 19, 4:00 PM' });
});

test('prompt carries profile and options but no private calendar data', () => {
  const msgs = buildPrompt(mel, [{ id: 'c1', game: game(), openSpots: 5, context: 'Thu 4 PM', score: 80 }], { dismissedTitles: ['Bouldering night'] });
  const payload = JSON.parse(msgs[1].content);
  assert.deepEqual(payload.USER.goals, ['meet new people', 'unwind and destress']);
  assert.deepEqual(payload.USER.passed_on, ['Bouldering night']);
  assert.equal(payload.OPTIONS[0].id, 'c1');
  assert.equal(payload.USER.first_name, 'Mel');
  assert.ok(!('id' in payload.USER) && !msgs[1].content.includes('host'));
});

test('model output is validated: unknown ids, duplicates, junk and bad JSON are dropped', () => {
  const ok = parsePicks('```json\n{"picks":[{"id":"c2","fit":120,"reason":"  Fits right   after class. "},{"id":"c9","fit":90,"reason":"made up option"},{"id":"c2","fit":50,"reason":"duplicate pick"},{"id":"c1","fit":40,"reason":"ok"}]}\n```', ['c1', 'c2']);
  assert.deepEqual(ok, [{ id: 'c2', fit: 100, reason: 'Fits right after class.' }]);
  assert.deepEqual(parsePicks('not json', ['c1']), []);
  assert.deepEqual(parsePicks('{"picks":"nope"}', ['c1']), []);
});

test('fallback reasons read naturally', () => {
  assert.equal(fallbackReason({ signals: ['you’re into basketball'], note: 'after your PHYS 132 (ends 2:30 PM)' }),
    'Picked because you’re into basketball, after your PHYS 132 (ends 2:30 PM).');
  assert.equal(fallbackReason({ signals: [], note: '' }), 'Picked from what you told us you like.');
});

test('notifications: strong new matches and nearly-full activities, capped on first run', () => {
  const picks = [
    { game: { id: 'a', title: 'A' }, fit: 90, reason: 'r', openSpots: 5 },
    { game: { id: 'b', title: 'B' }, fit: 80, reason: 'r', openSpots: 1 },
    { game: { id: 'c', title: 'C' }, fit: 50, reason: 'r', openSpots: 1 }
  ];
  const first = notificationsFor(picks, { firstRun: true });
  assert.deepEqual(first.map(n => `${n.kind}:${n.game_id}`), ['new_match:a', 'filling_up:b']);
  assert.equal(first[1].title, 'Only 1 spot left: B');
  assert.equal(notificationsFor(picks).filter(n => n.kind === 'new_match').length, 2);
});

test('helpers', () => {
  assert.ok(Math.abs(cosine([1, 0], [1, 0]) - 1) < 1e-9);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.match(profileText(mel), /Basketball, Running, Coffee.*meet new people, unwind and destress/);
  assert.equal(activityText(game({ description: 'All levels' })), 'Basketball activity: Pickup. All levels. At Rec Center.');
});
