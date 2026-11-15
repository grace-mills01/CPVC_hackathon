import test from 'node:test';
import assert from 'node:assert/strict';
import {badgeUnlocks, readBadgeHistory} from './badgeUnlocks.js';
const badges = [{id:'try-basketball'}, {id:'joined-15'}];
test('first profile visit celebrates existing earned badges instead of silently consuming them', () => {
 assert.deepEqual(badgeUnlocks(badges, null), {fresh:badges, seen:['try-basketball','joined-15']});
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

test('an event completed between profile visits earns a reveal, but leaving prevents it', async () => {
 const {activityBadges} = await import('./badges.js');
 const games = [{id:'game',sport:'Basketball',status:'scheduled',starts_at:'2026-11-14T18:00:00Z',ends_at:'2026-11-14T19:00:00Z'}];
 const roster = [{game_id:'game',user_id:'me'}];
 const before = activityBadges(games,roster,'me',new Date('2026-11-14T17:00:00Z')).earned;
 const initial = badgeUnlocks(before,null);
 assert.deepEqual(initial.fresh, []);
 const after = activityBadges(games,roster,'me',new Date('2026-11-14T20:00:00Z')).earned;
 assert.equal(badgeUnlocks(after,initial.seen).fresh[0].id,'try-basketball');
 assert.deepEqual(badgeUnlocks(activityBadges(games,[],'me',new Date('2026-11-14T20:00:00Z')).earned,initial.seen).fresh,[]);
});
