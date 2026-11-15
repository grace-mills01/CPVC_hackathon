import test from 'node:test';
import assert from 'node:assert/strict';
import {badgeUnlocks, readBadgeHistory} from './badgeUnlocks.js';
const badges = [{id:'try-basketball'}, {id:'joined-15'}];
test('first load establishes a baseline without replaying existing badges', () => {
 assert.deepEqual(badgeUnlocks(badges, null), {fresh:[], seen:['try-basketball','joined-15']});
});
test('new unlocks queue once and stay seen if history changes or the user returns', () => {
 const result = badgeUnlocks(badges, ['try-basketball','old-earned']);
 assert.deepEqual(result.fresh, [badges[1]]);
 assert.deepEqual(badgeUnlocks(badges, result.seen).fresh, []);
 const reduced = badgeUnlocks([], result.seen);
 assert.deepEqual(badgeUnlocks(badges, reduced.seen).fresh, []);
 assert.deepEqual(badgeUnlocks(badges, []).fresh, badges);
});
test('unavailable or malformed storage establishes a safe baseline', () => {
 for (const raw of [null, '{bad', '{}', '7']) assert.equal(readBadgeHistory({getItem:()=>raw},'key'),null);
 assert.equal(readBadgeHistory({getItem:()=>{throw Error('blocked');}},'key'),null);
 assert.deepEqual(readBadgeHistory({getItem:()=> '["try-basketball",null,4]'},'key'),['try-basketball']);
});
