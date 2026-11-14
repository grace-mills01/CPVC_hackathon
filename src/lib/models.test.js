import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_STATUSES, SKILL_LEVELS } from './models.js';

test('domain values include the default and cancellation states', () => {
  assert.ok(SKILL_LEVELS.includes('all_levels'));
  assert.deepEqual(GAME_STATUSES, ['scheduled', 'canceled']);
});
