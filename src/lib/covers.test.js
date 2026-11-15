import test from 'node:test';
import assert from 'node:assert/strict';
import {coverColors,randomCoverColor,coverColor,coverError,coverStyle} from './covers.js';
test('fallback uses the reference palette and stays stable across views',()=>{for(let i=0;i<30;i++)assert.ok(coverColors.includes(randomCoverColor()));const game={id:'event-123',cover_color:'#D086AB'};assert.equal(coverColor(game),'#D086AB');assert.equal(coverColor({id:'legacy'}),coverColor({id:'legacy'}));assert.ok(coverColors.includes(coverColor({cover_color:'invalid'})));assert.ok(!coverStyle(game).backgroundImage.includes('url('));assert.ok(coverStyle({...game,image_url:'https://example.com/photo.png'}).backgroundImage.includes('https://example.com/photo.png'));});
test('upload validation rejects unsupported files and oversized images',()=>{assert.equal(coverError({type:'image/png',size:5242880}),null);assert.ok(coverError({type:'image/svg+xml',size:100}));assert.ok(coverError({type:'image/jpeg',size:5242881}));});
