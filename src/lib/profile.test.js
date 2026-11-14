import test from 'node:test';
import assert from 'node:assert/strict';
import { profileActivity } from './profile.js';
test('profile counts completed activities and unique people, excludes canceled and unjoined games, sorts upcoming', () => {
 const game=(id,date,sport='Running',status='scheduled')=>({id,starts_at:date,sport,status});
 const games=[game('past','2026-01-01'),game('past2','2026-01-02','running'),game('cancel','2026-01-03','Soccer','canceled'),game('later','2026-12-02'),game('next','2026-12-01'),game('other','2026-01-04')];
 const roster=['past','past2','cancel','later','next'].map(game_id=>({game_id,user_id:'me'})).concat([{game_id:'past',user_id:'friend'},{game_id:'past2',user_id:'friend'},{game_id:'cancel',user_id:'other'}]);
 const result=profileActivity(games,roster,'me',new Date('2026-11-14'));
 assert.deepEqual(result.upcoming.map(g=>g.id),['next','later']);
 assert.equal(result.sports,1);assert.equal(result.sessions,2);assert.equal(result.people,1);
});
test('empty profile has zero stats',()=>assert.deepEqual(profileActivity([],[],'me'),{upcoming:[],sports:0,sessions:0,people:0}));
