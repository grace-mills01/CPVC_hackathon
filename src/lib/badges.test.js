import test from 'node:test';
import assert from 'node:assert/strict';
import {activityBadges} from './badges.js';
const now = new Date('2026-11-14T20:00:00Z');
const game = (id, overrides = {}) => ({id, sport:'Study session', host_id:'me', status:'scheduled', starts_at:'2026-11-01T18:00:00Z', ends_at:'2026-11-01T20:00:00Z', ...overrides});
const rosterFor = games => games.map(g => ({game_id:g.id, user_id:'me'}));
test('repeated milestones and normalized new activities are earned from completed activities', () => {
 const games = Array.from({length:50}, (_,i) => game(i, {sport:i%2?' Study  session ':'study session'}));
 const result = activityBadges(games, rosterFor(games), 'me', now);
 assert.equal(result.hours,100);
 assert.equal(result.earned.filter(b=>b.id.startsWith('try-')).length,1);
 assert.equal(result.earned.filter(b=>b.id.startsWith('host-')).length,5);
 assert.equal(result.earned.filter(b=>b.id.startsWith('joined-')).length,3);
 assert.deepEqual(result.earned.filter(b=>b.id.startsWith('hours-')).map(b=>b.id),['hours-50','hours-100']);
 assert.ok(result.earned.some(b=>b.id==='study'));
});
test('canceled, future, unfinished and unjoined activities do not count', () => {
 const games = [game(1,{status:'canceled'}),game(2,{starts_at:'2026-12-01T18:00:00Z',ends_at:'2026-12-01T20:00:00Z'}),game(3,{ends_at:'2026-12-01T20:00:00Z'}),game(4)];
 assert.equal(activityBadges(games,rosterFor(games.slice(0,3)),'me',now).earned.length,0);
});
test('crowds count unique people and hours require a valid end', () => {
 const games = [game(1,{ends_at:null})];
 const roster = [...rosterFor(games), ...Array.from({length:4},(_,i)=>({game_id:1,user_id:`other-${i}`})),{game_id:1,user_id:'me'}];
 const result = activityBadges([...games,...games],roster,'me',now);
 assert.equal(result.hours,0);
 assert.equal(result.participated,1);
 assert.equal(result.biggest,5);
 assert.ok(result.earned.some(b=>b.id==='crowd-5'));
});
test('special time badges use Pacific start times and strict boundaries', () => {
 const badgesAt = time => {
  const games = [game(1,{starts_at:time,ends_at:null})];
  return activityBadges(games,rosterFor(games),'me',now).earned.map(b=>b.id);
 };
 assert.ok(badgesAt('2026-11-02T07:01:00Z').includes('night'));
 assert.ok(!badgesAt('2026-11-02T07:00:00Z').includes('night'));
 assert.ok(badgesAt('2026-11-02T12:59:00Z').includes('early'));
 assert.ok(!badgesAt('2026-11-02T13:00:00Z').includes('early'));
});
test('five distinct activities unlock exploration; no user earns nothing', () => {
 const games = ['Study','Running','Tennis','Swimming','Hiking'].map((sport,i)=>game(i,{sport}));
 assert.ok(activityBadges(games,rosterFor(games),'me',now).earned.some(b=>b.id==='explorer'));
 assert.equal(activityBadges(games,rosterFor(games),null,now).earned.length,0);
});

test('activity symbols match catalog and custom activities have a fallback', async () => {
 const {activityBadgeIcon} = await import('./badges.js');
 const symbols = {'Basketball':'basketball','Beach volleyball':'volleyball','Soccer':'soccer','Futsal':'soccer','Pickleball':'paddle','Badminton':'shuttle','Racquetball':'racket','Dodgeball':'ball','Flag football':'football','Frisbee':'disc','Running':'shoe','Swimming':'waves','Climbing':'mountain','Study group':'book','Coffee':'cup','Food and dining':'utensils','Downtown hangout':'city','Arts and culture':'palette','Other social':'people','Tennis':'racket','Hiking':'trail','Cycling':'bike','Yoga':'fitness','Music':'music'};
 for (const [name, icon] of Object.entries(symbols)) assert.equal(activityBadgeIcon(` ${name.toUpperCase()} `),icon,name);
 assert.equal(activityBadgeIcon('Custom mystery activity'),'spark');
 const games=[game(1,{sport:'Basketball'})];
 assert.equal(activityBadges(games,rosterFor(games),'me',now).earned.find(b=>b.id==='try-basketball').icon,'basketball');
});
test('unique achievements require distinct types, venues, companions and one actual weekend', () => {
 const games=['Study','Running','Tennis','Swimming','Hiking'].map((sport,id)=>game(id,{sport,venue:`Venue ${id}`,starts_at:id===4?'2026-11-08T18:00:00Z':'2026-11-07T18:00:00Z',ends_at:null}));
 const roster=[...rosterFor(games),...games.flatMap(g=>[{game_id:g.id,user_id:'friend'},{game_id:g.id,user_id:'friend'}])];
 const ids=activityBadges(games,roster,'me',now).earned.map(b=>b.id);
 for (const id of ['hat-trick','familiar-faces','around-town','weekend']) assert.ok(ids.includes(id),id);
 const repeated=games.map(g=>({...g,sport:'Study',venue:' Venue 1 ',starts_at:'2026-11-07T18:00:00Z'}));
 const fewer=activityBadges(repeated,roster.slice(0,5),'me',now).earned.map(b=>b.id);
 for (const id of ['hat-trick','familiar-faces','around-town','weekend']) assert.ok(!fewer.includes(id),id);
});
test('weekend achievements do not combine different weekends and days use Pacific time', () => {
 const dates=['2026-11-08T07:30:00Z','2026-11-16T07:30:00Z']; // Pacific Saturday, following Sunday
 const games=dates.map((starts_at,id)=>game(id,{starts_at,ends_at:null}));
 assert.ok(!activityBadges(games,rosterFor(games),'me',new Date('2026-11-20')).earned.some(b=>b.id==='weekend'));
 games[1].starts_at='2026-11-09T07:30:00Z'; // Pacific Sunday of the same weekend
 assert.ok(activityBadges(games,rosterFor(games),'me',now).earned.some(b=>b.id==='weekend'));
});
