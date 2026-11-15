import React, { useEffect, useRef, useState } from 'react';
import Button from '../../components/Button.jsx';
import { loadScheduleAvailability } from './api.js';
import { refreshCalendarFeedIfStale } from '../profiles/api.js';
import { addDays, dateKey, daySegments, layoutEvents, mergeBusy, weeklySegments } from './schedule.js';
import './schedule.css';

const time = date => new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const position = block => ({ top: `${block.start / 1440 * 100}%`, height: `${(block.end - block.start) / 1440 * 100}%` });

export function CalendarView({ events, blocks = [], weekly = [], onOpen, onDiscover, onSettings, loading = false, error = '', initialDate = new Date(), initialSpan = 3, onDateChange, onSpanChange }) {
  const [day, updateDay] = useState(() => addDays(initialDate, 0));
  const [span, updateSpan] = useState(initialSpan);
  const setDay = next => { updateDay(next); onDateChange?.(next); };
  const setSpan = next => { updateSpan(next); onSpanChange?.(next); };
  const [now, setNow] = useState(new Date());
  const scroller = useRef(null);
  useEffect(() => { scroller.current.scrollTop = 7 * 64; }, []);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const days = Array.from({ length: span }, (_, i) => addDays(day, i));
  const week = addDays(day, -day.getDay());
  const busyFor = d => mergeBusy([...daySegments(blocks, d), ...weeklySegments(weekly, d)]);
  const label = day.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const hasEvents = days.some(d => daySegments(events, d).length);
  return <section className="schedule" aria-label="Your calendar">
    <div className="schedule-title"><div><small>MAKE TIME FOR GOOD COMPANY</small><h2>Your calendar</h2></div><Button variant="quiet" onClick={onSettings}>Availability</Button></div>
    <div className="schedule-toolbar"><h3 aria-live="polite">{label}</h3><Button variant="outline" onClick={() => setDay(addDays(new Date(), 0))}>Today</Button></div>
    <div className="schedule-controls"><div className="schedule-modes" aria-label="Calendar view">{[1, 3].map(n => <Button key={n} variant="chip" aria-pressed={span === n} onClick={() => setSpan(n)}>{n === 1 ? 'Day' : '3 days'}</Button>)}</div><div className="schedule-paging"><Button variant="icon" aria-label={`Previous ${span === 1 ? 'day' : '3 days'}`} onClick={() => setDay(addDays(day, -span))}>‹</Button><Button variant="icon" aria-label={`Next ${span === 1 ? 'day' : '3 days'}`} onClick={() => setDay(addDays(day, span))}>›</Button></div></div>
    <div className="schedule-week" aria-label="Choose a day">{Array.from({ length: 7 }, (_, i) => {
      const date = addDays(week, i), key = dateKey(date);
      return <Button key={key} variant="schedule-day" aria-label={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} aria-pressed={key === dateKey(day)} aria-current={key === dateKey(now) ? 'date' : undefined} onClick={() => setDay(date)}><span>{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span><strong>{date.getDate()}</strong><i className={daySegments(events, date).length ? 'has-events' : ''}/></Button>;
    })}</div>
    <div className="schedule-legend"><span><i/>ToGo activities</span><span><i/>Busy / unavailable</span></div>
    {loading && <p role="status" className="schedule-status">Loading calendar availability…</p>}
    {error && <p role="alert" className="schedule-status">{error}</p>}
    <div className="schedule-grid-head" style={{ '--days': span }}><span>{Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ')}</span>{days.map(d => <div key={dateKey(d)} className={dateKey(d) === dateKey(now) ? 'is-today' : ''}><span>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span><strong>{d.getDate()}</strong></div>)}</div>
    <div className="schedule-scroll" ref={scroller} tabIndex={0} aria-label="Hourly calendar, scroll to see all 24 hours">
      <div className="schedule-time-grid" style={{ '--days': span }}>
        <div className="schedule-hours" aria-hidden="true">{Array.from({ length: 24 }, (_, h) => <span key={h} style={{ top: h * 64 }}>{h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}</span>)}</div>
        {days.map(d => <div className="schedule-column" key={dateKey(d)} aria-label={d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}>
          {busyFor(d).map((b, i) => <div key={i} className="schedule-busy" style={position(b)}><span>Busy</span><span className="schedule-sr">{Math.floor(b.start / 60)}:{String(b.start % 60).padStart(2, '0')}–{Math.floor(b.end / 60)}:{String(b.end % 60).padStart(2, '0')}</span></div>)}
          {layoutEvents(daySegments(events, d)).map(e => <Button key={e.id} variant="schedule-event" className="schedule-event" style={{ ...position(e), left: `calc(${e.column / e.columns * 100}% + 2px)`, width: `calc(${100 / e.columns}% - 4px)` }} onClick={() => onOpen(e)} aria-label={`${e.title}, ${time(e.starts_at)} to ${time(e.ends_at || new Date(new Date(e.starts_at).getTime() + 3600000))}, ${e.venue}. Open activity`}><strong>{e.title}</strong><span>{time(e.starts_at)}</span><span>{e.venue}</span></Button>)}
          {dateKey(d) === dateKey(now) && <div className="schedule-now" style={{ top: `${(now.getHours() * 60 + now.getMinutes()) / 1440 * 100}%` }} aria-label="Current time"/>}
        </div>)}
      </div>
    </div>
    {!hasEvents && <div className="schedule-empty"><p>No ToGo activities on these days.</p><Button variant="secondary" onClick={onDiscover}>Find an activity</Button></div>}
    <p className="schedule-note">Times shown in your local time zone. Busy times include connected calendars and the times you’ve blocked out.</p>
  </section>;
}

export default function ScheduleCalendar({ userId, ...props }) {
  const [state, setState] = useState({ blocks: [], weekly: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    async function load() {
      await refreshCalendarFeedIfStale();
      const availability = await loadScheduleAvailability(userId);
      if (active) setState({ ...availability, loading: false });
    }
    load().catch(() => { if (active) setState(s => ({ ...s, loading: false, error: 'Busy times couldn’t load. Reopen Calendar to try again.' })); });
    return () => { active = false; };
  }, [userId]);
  return <CalendarView {...props} {...state}/>;
}
