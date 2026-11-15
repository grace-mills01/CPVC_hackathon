import React, {useEffect, useRef, useState} from 'react';
import Button from '../components/Button.jsx';
import {coverError} from '../lib/covers.js';
import {defaultFrame, drawBanner, loadPhoto} from '../lib/bannerCrop.js';

export default function CoverPhoto({file,color,onChange,disabled,frame,onFrameChange}) {
 const input=useRef(null), canvas=useRef(null);
 const [image,setImage]=useState(null),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;setImage(null);
  if(file)loadPhoto(file).then(next=>{if(active)setImage(next)}).catch(e=>{if(active){setError(e.message);onChange(null)}});
  return()=>{active=false};
 },[file,onChange]);
 useEffect(()=>{if(image&&canvas.current)drawBanner(canvas.current,image,frame)},[image,frame]);
 return <div className="cover-picker">
  <div className="host-cover banner-preview" style={{backgroundColor:color}}>
   {image&&<canvas ref={canvas} width="1200" height="600" aria-label="Preview of your selected banner crop"/>}
   {!image&&file&&<p role="status">Opening photo…</p>}
  </div>
  <div className="cover-actions">
   <Button variant="secondary" disabled={disabled} type="button" onClick={()=>input.current.click()}>{file?'Change photo':'Upload photo'}</Button>
   {file&&<Button variant="secondary" disabled={disabled} type="button" onClick={()=>{onChange(null);onFrameChange({...defaultFrame});setError('')}}>Remove photo</Button>}
  </div>
  {image&&<fieldset className="banner-framing" disabled={disabled}>
   <legend>Frame your banner</legend>
   <p>Zoom in, then move the photo to choose what appears. Your selected crop is saved with the activity.</p>
   {[['zoom','Zoom',1,3,0.05],['x','Horizontal position',0,100,1],['y','Vertical position',0,100,1]].map(([key,label,min,max,step])=><label key={key}>{label}<input type="range" min={min} max={max} step={step} value={frame[key]} onChange={e=>onFrameChange({...frame,[key]:Number(e.target.value)})}/></label>)}
   <Button variant="quiet" type="button" onClick={()=>onFrameChange({...defaultFrame})}>Reset framing</Button>
  </fieldset>}
  <input ref={input} hidden disabled={disabled} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload activity cover photo" onChange={e=>{
   const next=e.target.files?.[0];e.target.value='';if(!next)return;
   const message=coverError(next);setError(message||'');
   if(!message){onFrameChange({...defaultFrame});onChange(next)}
  }}/>
  <p className="cover-hint">{file?'Your photo':'Random Dusty Bloom background'} · JPEG, PNG or WebP, up to 5 MB</p>
  {error&&<p className="alert" role="alert">{error}</p>}
 </div>;
}
