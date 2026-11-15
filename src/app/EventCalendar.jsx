import React,{useState} from 'react';
import Button from '../components/Button.jsx';
import {dateKey,monthDays} from '../lib/eventViews.js';
import './event-calendar.css';
export function EventList({events,onOpen}){
 return <div className="event-agenda">{events.map(game=><Button key={game.id} variant="plan" className="event-agenda-item" onClick={()=>onOpen(game)}>
  <span className="event-agenda-date">{new Date(game.starts_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>
  <span><strong>{game.title}</strong><small>{new Date(game.starts_at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})} · {game.venue}</small></span><span aria-hidden="true">›</span>
 </Button>)}</div>;
}
export default function EventCalendar({kind,events,onBack,onOpen,onDiscover,onHost}){
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1)),[day,setDay]=useState(null);
 const title=kind==='hosting'?'Events hosting':'Events attending';
 const monthEvents=events.filter(g=>{const d=new Date(g.starts_at);return d.getFullYear()===month.getFullYear()&&d.getMonth()===month.getMonth()});
 const counts=monthEvents.reduce((map,g)=>{const key=dateKey(new Date(g.starts_at));map[key]=(map[key]||0)+1;return map},{});
 const shown=day?monthEvents.filter(g=>dateKey(new Date(g.starts_at))===day):monthEvents;
 function move(offset){setMonth(new Date(month.getFullYear(),month.getMonth()+offset,1));setDay(null)}
 return <section className="event-calendar" aria-label={title}>
  <Button variant="quiet" onClick={onBack}>← Back to profile</Button><h2>{title}</h2>
  <p>{kind==='hosting'?'Upcoming events you’re bringing together.':'Upcoming events you’ve joined, hosted by others.'}</p>
  <div className="event-month-controls"><Button variant="icon" aria-label="Previous month" onClick={()=>move(-1)}>‹</Button><h3 aria-live="polite">{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><Button variant="icon" aria-label="Next month" onClick={()=>move(1)}>›</Button></div>
  <div className="event-month-grid" aria-label="Calendar dates">
   {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span className="event-weekday" key={d}>{d}</span>)}
   {monthDays(month).map((date,i)=>date?<Button key={dateKey(date)} variant="calendar-day" aria-pressed={day===dateKey(date)} aria-current={dateKey(date)===dateKey(new Date())?'date':undefined} aria-label={`${date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}, ${counts[dateKey(date)]||0} events`} onClick={()=>setDay(day===dateKey(date)?null:dateKey(date))}><span>{date.getDate()}</span>{counts[dateKey(date)]>0&&<small>{counts[dateKey(date)]}<span className="sr-only"> events</span></small>}</Button>:<span key={'empty'+i}/>)}
  </div>
  <div className="event-agenda-heading"><h3>{day?'Selected day':'This month'} · {shown.length} {shown.length===1?'event':'events'}</h3>{day&&<Button variant="quiet" onClick={()=>setDay(null)}>Show whole month</Button>}</div>
  <div aria-live="polite">{shown.length?<EventList events={shown} onOpen={onOpen}/>:<p className="event-empty">{events.length?'No events '+(day?'on this day.':'this month. Try another month.'):`No upcoming events ${kind==='hosting'?'hosted':'joined'} yet.`}</p>}</div>
  <Button variant="secondary" onClick={kind==='hosting'?onHost:onDiscover}>{kind==='hosting'?'Host an activity':'Find an activity'}</Button>
 </section>;
}
export function ActivityLog({events,onBack,onOpen,onDiscover}){
 return <section className="event-calendar" aria-label="Activity log"><Button variant="quiet" onClick={onBack}>← Back to profile</Button><h2>Activity log</h2><p>Your past activities, most recent first. Includes events you hosted.</p>{events.length?<EventList events={events} onOpen={onOpen}/>:<div className="event-empty"><p>No past activities yet. Your completed plans will appear here.</p><Button variant="secondary" onClick={onDiscover}>Find an activity</Button></div>}</section>;
}
