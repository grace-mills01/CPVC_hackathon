import React, { useEffect, useRef, useState } from 'react';
import Button from '../components/Button.jsx';
import { coverError } from '../lib/covers.js';
export default function CoverPhoto({file,color,onChange,disabled}) {
 const input=useRef(null);
 const [preview,setPreview]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(!file){setPreview('');return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
 return <div className="cover-picker"><div className="host-cover" style={{backgroundColor:color}}>{preview&&<img src={preview} alt="Your activity cover"/>}<div className="cover-actions"><Button variant="secondary" disabled={disabled} type="button" onClick={()=>input.current.click()}>▧ {file?'Change photo':'Upload photo'}</Button>{file&&<Button variant="secondary" disabled={disabled} type="button" onClick={()=>{onChange(null);setError('')}}>Remove photo</Button>}</div></div><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload activity cover photo" onChange={e=>{const next=e.target.files?.[0];e.target.value='';if(!next)return;const message=coverError(next);setError(message||'');if(!message)onChange(next)}}/><p className="cover-hint">{file?'Your photo':'Random Dusty Bloom background'} · JPEG, PNG or WebP, up to 5 MB</p>{error&&<p className="alert" role="alert">{error}</p>}</div>;
}
