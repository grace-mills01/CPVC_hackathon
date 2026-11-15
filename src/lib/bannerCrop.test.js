import test from 'node:test';
import assert from 'node:assert/strict';
import {cropRectangle,defaultFrame,drawBanner} from './bannerCrop.js';
test('portrait and landscape photos fill the 2:1 banner without stretching',()=>{
 assert.deepEqual(cropRectangle(1000,2000),{x:0,y:750,width:1000,height:500});
 assert.deepEqual(cropRectangle(3000,1000),{x:500,y:0,width:2000,height:1000});
});
test('zoom and position expose the edges without empty space',()=>{
 for(const [w,h] of [[1000,2000],[3000,1000]])for(const zoom of [1,2,3])for(const x of [0,50,100])for(const y of [0,50,100]){
  const r=cropRectangle(w,h,{x,y,zoom});
  assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=w+0.001&&r.y+r.height<=h+0.001);
  assert.equal(r.width/r.height,2);
 }
 assert.deepEqual(cropRectangle(1000,2000,{x:100,y:100,zoom:2}),{x:500,y:1750,width:500,height:250});
});
test('invalid frame values are clamped or centered',()=>{
 assert.deepEqual(cropRectangle(1000,2000,{x:NaN,y:NaN,zoom:Infinity}),cropRectangle(1000,2000,defaultFrame));
 assert.deepEqual(cropRectangle(1000,2000,{x:-9,y:999,zoom:0}),{x:0,y:1500,width:1000,height:500});
});
test('preview and output draw the selected source rectangle',()=>{
 let args;const image={naturalWidth:1000,naturalHeight:2000};
 const canvas={width:1600,height:800,getContext:()=>({clearRect(){},drawImage(...values){args=values}})};
 drawBanner(canvas,image,{x:100,y:100,zoom:2});
 assert.deepEqual(args,[image,500,1750,500,250,0,0,1600,800]);
});
