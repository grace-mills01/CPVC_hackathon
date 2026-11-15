import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daySegments, layoutEvents, mergeBusy, weeklySegments } from './schedule.js';
const local = (day, hour, minute = 0) => new Date(2026, 10, day, hour, minute).toISOString();
test('overnight activities are clipped to both local days without leaking into the next', () => {
  const events = [{ id: 'night', starts_at: local(14, 23), ends_at: local(15, 1) }];
  assert.deepEqual(daySegments(events, new Date(2026, 10, 14)).map(e => [e.start, e.end]), [[1380, 1440]]);
  assert.deepEqual(daySegments(events, new Date(2026, 10, 15)).map(e => [e.start, e.end]), [[0, 60]]);
  assert.equal(daySegments(events, new Date(2026, 10, 16)).length, 0);
});
test('missing end time gets a one-hour display; invalid and zero-duration entries are ignored', () => {
  assert.equal(daySegments([{ starts_at: local(14, 9) }], new Date(2026, 10, 14))[0].end, 600);
  assert.equal(daySegments([{ starts_at: 'invalid' }, { starts_at: local(14, 9), ends_at: local(14, 9) }], new Date(2026, 10, 14)).length, 0);
});
test('weekly times are expanded on matching local weekdays', () => {
  const day = new Date(2026, 10, 14);
  assert.deepEqual(weeklySegments([{ weekday: day.getDay(), start_time: '09:30:00', end_time: '11:00:00' }, { weekday: (day.getDay() + 1) % 7, start_time: '08:00', end_time: '09:00' }], day).map(e => [e.start, e.end]), [[570, 660]]);
});
test('busy sources combine overlapping and adjacent blocks without changing originals', () => {
  const blocks = [{ start: 90, end: 120 }, { start: 30, end: 100 }, { start: 120, end: 180 }, { start: 240, end: 300 }];
  assert.deepEqual(mergeBusy(blocks), [{ start: 30, end: 180 }, { start: 240, end: 300 }]);
  assert.equal(blocks[1].end, 100);
});
test('overlapping event clusters get separate lanes and reuse available lanes', () => {
  const layout = layoutEvents([{ id: 'a', start: 60, end: 180 }, { id: 'b', start: 90, end: 120 }, { id: 'c', start: 120, end: 240 }, { id: 'd', start: 240, end: 300 }]);
  assert.deepEqual(layout.map(e => [e.id, e.column, e.columns]), [['a', 0, 2], ['b', 1, 2], ['c', 1, 2], ['d', 0, 1]]);
});
test('day navigation crosses month and year boundaries at local midnight', () => {
  const d = addDays(new Date(2026, 11, 31, 23), 1);
  assert.equal(d.getFullYear(), 2027); assert.equal(d.getMonth(), 0); assert.equal(d.getDate(), 1); assert.equal(d.getHours(), 0);
});
