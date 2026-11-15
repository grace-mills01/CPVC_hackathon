import React, {useState} from 'react';
import Button from '../components/Button.jsx';
import CoverPhoto from './CoverPhoto.jsx';
import {supabase} from '../lib/supabase.js';
import {cropBanner, defaultFrame} from '../lib/bannerCrop.js';

export function localDateTime(value) {
 const date=new Date(value);
 return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
export default function EditActivity({game,count,onCancel,onSaved}) {
 const [file,FILE]=useState(null),[frame,FRAME]=useState({...defaultFrame}),[remove,REMOVE]=useState(false),[busy,BUSY]=useState(false),[error,ERROR]=useState('');
 async function save(event) {
  event.preventDefault();if(busy)return;
  const data=new FormData(event.currentTarget);BUSY(true);ERROR('');let path=null, saved=false;
  try {
   let image=remove?null:game.image_url;
   if(file){const banner=await cropBanner(file,frame);path=`${game.host_id}/${crypto.randomUUID()}`;const result=await supabase.storage.from('activity-covers').upload(path,banner,{contentType:banner.type});if(result.error)throw result.error;image=supabase.storage.from('activity-covers').getPublicUrl(path).data.publicUrl;}
   const {data:updated,error}=await supabase.rpc('update_game',{p_game_id:game.id,p_title:data.get('title').trim(),p_sport:data.get('sport').trim(),p_venue:data.get('venue').trim(),p_starts_at:data.get('time')===localDateTime(game.starts_at)?game.starts_at:new Date(data.get('time')).toISOString(),p_capacity:Number(data.get('capacity')),p_description:data.get('description').trim(),p_status:data.get('status'),p_image_url:image,p_cover_color:data.get('cover_color')||null});
   if(error)throw error;saved=true;await onSaved(updated);
  } catch(error){if(path&&!saved)await supabase.storage.from('activity-covers').remove([path]);ERROR(error.message);} finally {BUSY(false);}
 }
 return <section className="host-page"><Button variant="quiet" disabled={busy} onClick={onCancel}>← Back to activity</Button><h2>Edit activity</h2><p>Saved changes will be shared with your group chat.</p>
 <form className="host-form" onSubmit={save}><fieldset disabled={busy}>
 <label>Activity type<input name="sport" required maxLength="80" defaultValue={game.sport}/></label>
 <label>Activity title<input name="title" required maxLength="100" defaultValue={game.title}/></label>
 <label>Date and time<input name="time" type="datetime-local" required defaultValue={localDateTime(game.starts_at)}/></label>
 <label>Location<input name="venue" required maxLength="120" defaultValue={game.venue}/></label>
 <label>Max spots<input name="capacity" type="number" required min={Math.max(2,count)} max="100" defaultValue={game.capacity}/></label><p>Capacity includes the host and cannot be below the current {count} participants.</p>
 <label>Details<textarea name="description" maxLength="10000" defaultValue={game.description}/></label>
 <label>Status<select name="status" defaultValue={game.status}><option value="scheduled">Scheduled</option><option value="canceled">Canceled</option></select></label>
 <label>Background color<select name="cover_color" defaultValue={game.cover_color||''}><option value="">Default</option>{[['#315E5C','Forest'],['#CA5323','Clay'],['#D086AB','Pink'],['#EEEDD9','Cream'],['#E6B545','Gold']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 {game.image_url&&!remove&&!file&&<><img src={game.image_url} alt="Current activity cover" style={{width:'100%'}}/><Button variant="secondary" type="button" onClick={()=>REMOVE(true)}>Remove current photo</Button></>}
 {remove&&<Button variant="quiet" type="button" onClick={()=>REMOVE(false)}>Restore current photo</Button>}
 <CoverPhoto file={file} onChange={FILE} frame={frame} onFrameChange={FRAME} color={game.cover_color} disabled={busy}/>
 </fieldset>{error&&<p className="alert" role="alert">{error}</p>}<div className="row"><Button variant="primary" disabled={busy}>{busy?'Saving…':'Save changes'}</Button><Button variant="quiet" type="button" disabled={busy} onClick={onCancel}>Cancel</Button></div></form></section>;
}
