import test from 'node:test';import assert from 'node:assert/strict';
import {eventViews,dateKey,monthDays,pageFromHash,profileRoutes} from './eventViews.js';
test('separates upcoming attendance and hosting, excludes canceled, past and unrelated events',()=>{
 const g=(id,host_id,starts_at,status='scheduled',ends_at)=>({id,host_id,starts_at,status,ends_at});
 const games=[g('host','me','2026-12-01'),g('attend','other','2026-12-02'),g('unrelated','other','2026-12-01'),g('past','other','2026-10-01'),g('past-host','me','2026-10-02'),g('canceled','me','2026-12-01','canceled'),g('running','me','2026-11-13','scheduled','2026-11-16'),g('left','other','2026-10-01')];
 const roster=['host','attend','past'].map(game_id=>({game_id,user_id:'me'})).concat({game_id:'unrelated',user_id:'friend'});
 const views=eventViews(games,roster,'me',new Date('2026-11-14'));
 assert.deepEqual(views.attending.map(g=>g.id),['attend']);assert.deepEqual(views.hosting.map(g=>g.id),['host']);assert.deepEqual(views.past.map(g=>g.id),['past-host','past']);
});
test('local calendar keys and month padding handle leap years and year boundaries',()=>{
 assert.equal(dateKey(new Date(2026,0,1,0,15)),'2026-01-01');
 for(const [year,month,count] of [[2024,1,29],[2026,10,30],[2026,11,31],[2027,0,31]]){
  const cells=monthDays(new Date(year,month,1));const dates=cells.filter(Boolean);
  assert.equal(dates.length,count);assert.equal(cells.length%7,0);assert.equal(cells.findIndex(Boolean),new Date(year,month,1).getDay());assert.equal(dates[dates.length-1].getDate(),count);
 }
});
test('profile route URLs round trip and unknown hashes fall back safely',()=>{
 for(const [page,path] of Object.entries(profileRoutes))assert.equal(pageFromHash('#'+path),page);
 assert.equal(pageFromHash('#unknown'),'discover');assert.equal(pageFromHash(''),'discover');
 assert.deepEqual(eventViews([],[],'me'),{attending:[],hosting:[],past:[]});
});
