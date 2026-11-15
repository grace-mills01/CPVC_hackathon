import React, { useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import { WEEKDAY_LABELS, expandWeeklyBusy, oneOffBlock, validateWeeklyEntry } from './availability.js';
import * as api from './api.js';

const PROVIDERS = { apple: 'Apple Calendar', google: 'Google Calendar', outlook: 'Outlook' };

const LINK_HELP = {
  apple: {
    steps: [
      'iPhone: open Calendar → Calendars → tap ⓘ next to your calendar → turn on Public Calendar → Share Link → Copy.',
      'Mac: in Calendar, right-click the calendar → Share Calendar → check Public → copy the link.'
    ],
    note: 'Public means anyone with the link could view that calendar, so only paste it here.'
  },
  google: {
    steps: ['On a computer, open Google Calendar → Settings → pick your calendar → copy “Secret address in iCal format”.'],
    note: 'Keep this link private; it shows your events to anyone who has it.'
  },
  outlook: {
    steps: ['Outlook on the web → Settings → Calendar → Shared calendars → Publish a calendar → choose “Can view when I’m busy” → copy the ICS link.'],
    note: 'The “busy only” option shares times without event details.'
  }
};

const EMPTY_WEEKLY = { weekdays: [], start_time: '', end_time: '', label: '' };
const EMPTY_ONCE = { date: '', start_time: '', end_time: '', label: '' };

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatRange(block) {
  const s = new Date(block.starts_at), e = new Date(block.ends_at);
  const day = s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} ${time(s)} – ${time(e)}`;
}

function timeAgo(iso) {
  if (!iso) return 'not synced yet';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'synced just now';
  if (minutes < 60) return `synced ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `synced ${hours} hr ago` : `synced ${Math.round(hours / 24)} days ago`;
}

/**
 * Lets a user share availability three ways: Google sign-in, a calendar link
 * (Apple/Google/Outlook, re-synced automatically), or blocking out times by hand.
 * Reports the combined busy blocks through onBusyChange for matching.
 */
export default function AvailabilityEditor({ session, returnedFromGoogle = false, onBusyChange }) {
  const userId = session.user.id;
  const [weekly, setWeekly] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [feed, setFeed] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkProvider, setLinkProvider] = useState('apple');
  const [linkUrl, setLinkUrl] = useState('');
  const [manualMode, setManualMode] = useState(null); // null | 'weekly' | 'once'
  const [weeklyDraft, setWeeklyDraft] = useState(EMPTY_WEEKLY);
  const [onceDraft, setOnceDraft] = useState(EMPTY_ONCE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function run(fn) {
    setError(''); setNotice(''); setBusy(true);
    try { await fn(); } catch (e) { setError(e.message || 'Something went wrong.'); } finally { setBusy(false); }
  }

  const reloadBlocks = async () => setBlocks(await api.loadBusyBlocks());

  useEffect(() => {
    run(async () => {
      const [w, b, f] = await Promise.all([api.loadWeeklyBusy(), api.loadBusyBlocks(), api.loadCalendarFeed()]);
      setWeekly(w); setBlocks(b); setFeed(f);
      if (returnedFromGoogle && session.provider_token) {
        const { blocks: synced, calendars } = await api.syncGoogleBusy(userId, session.provider_token);
        await reloadBlocks();
        setNotice(`Google Calendar connected · checked ${calendars} ${calendars === 1 ? 'calendar' : 'calendars'} · ${synced.length} busy ${synced.length === 1 ? 'time' : 'times'} in the next 4 weeks`);
      } else if (returnedFromGoogle) {
        throw new Error(api.consumeAuthRedirectError() || 'Google didn’t share calendar access. Try connecting again.');
      }
    });
  }, []);

  useEffect(() => { onBusyChange?.([...blocks, ...expandWeeklyBusy(weekly)]); }, [blocks, weekly]);

  async function saveLink(e) {
    e.preventDefault();
    await run(async () => {
      const result = await api.syncCalendarFeed({ url: linkUrl });
      setFeed(await api.loadCalendarFeed());
      await reloadBlocks();
      setLinkOpen(false); setLinkUrl('');
      setNotice(`${PROVIDERS[result.provider]} connected · ${result.count} busy ${result.count === 1 ? 'time' : 'times'} found. It re-syncs automatically.`);
    });
  }

  async function addWeekly(e) {
    e.preventDefault();
    const problem = validateWeeklyEntry(weeklyDraft);
    if (problem) return setError(problem);
    await run(async () => {
      const rows = await api.addWeeklyBusy(userId, weeklyDraft);
      setWeekly(w => [...w, ...rows].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)));
      setWeeklyDraft(EMPTY_WEEKLY);
    });
  }

  async function addOnce(e) {
    e.preventDefault();
    const { block, error: problem } = oneOffBlock(onceDraft);
    if (problem) return setError(problem);
    await run(async () => {
      const row = await api.addManualBlock(userId, { ...block, label: onceDraft.label });
      setBlocks(list => [...list, row].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
      setOnceDraft(EMPTY_ONCE);
    });
  }

  const googleCount = blocks.filter(b => b.source === 'google').length;
  const feedCount = blocks.filter(b => b.source === 'feed').length;
  const manualBlocks = blocks.filter(b => b.source === 'manual');
  const help = LINK_HELP[linkProvider];

  return <div className="avail">
    {error && <p role="alert" className="alert">{error}</p>}
    {notice && <p role="status" className="onb-notice">{notice}</p>}

    <h3 className="avail-heading">Sync a calendar</h3>
    <div className="onb-option">
      <div>
        <strong>Google Calendar</strong>
        <span>{googleCount ? `Connected · ${googleCount} busy times` : 'Sign in with Google to share busy times'}</span>
      </div>
      <Button variant={googleCount ? 'secondary' : 'primary'} disabled={busy} onClick={() => run(api.connectGoogleCalendar)}>
        {googleCount ? 'Sync again' : 'Connect'}
      </Button>
    </div>

    <div className="onb-option">
      <div>
        <strong>{feed ? PROVIDERS[feed.provider] : 'Apple Calendar'}</strong>
        <span>{feed
          ? (feed.last_error ? `Sync problem: ${feed.last_error}` : `Linked · ${feedCount} busy times · ${timeAgo(feed.last_synced_at)}`)
          : 'Paste your iCloud calendar link (Google and Outlook links work too)'}</span>
      </div>
      {feed
        ? <div className="avail-actions">
            <Button variant="secondary" disabled={busy} onClick={() => run(async () => { await api.syncCalendarFeed(); setFeed(await api.loadCalendarFeed()); await reloadBlocks(); })}>Sync now</Button>
            <Button variant="quiet" disabled={busy} onClick={() => run(async () => { await api.syncCalendarFeed({ remove: true }); setFeed(null); await reloadBlocks(); })}>Disconnect</Button>
          </div>
        : <Button variant="secondary" onClick={() => setLinkOpen(o => !o)}>{linkOpen ? 'Close' : 'Add link'}</Button>}
    </div>

    {linkOpen && !feed && <form className="onb-manual" onSubmit={saveLink}>
      <div className="onb-chips" role="group" aria-label="Calendar app">
        {Object.entries(PROVIDERS).map(([id, name]) =>
          <Button key={id} type="button" variant="chip" aria-pressed={linkProvider === id} onClick={() => setLinkProvider(id)}>{name}</Button>)}
      </div>
      <ol className="avail-steps">{help.steps.map(s => <li key={s}>{s}</li>)}</ol>
      <label>Calendar link<input required inputMode="url" autoComplete="off" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="webcal://… or https://…" /></label>
      <p className="avail-note">{help.note} ToGo saves only when you’re busy, never what your events are.</p>
      <Button variant="primary" disabled={busy || !linkUrl.trim()}>{busy ? 'Syncing…' : 'Connect calendar'}</Button>
    </form>}

    <h3 className="avail-heading">Block out times yourself</h3>
    <div className="onb-chips" role="group" aria-label="Block out times">
      <Button type="button" variant="chip" aria-pressed={manualMode === 'weekly'} onClick={() => setManualMode(m => m === 'weekly' ? null : 'weekly')}>Every week</Button>
      <Button type="button" variant="chip" aria-pressed={manualMode === 'once'} onClick={() => setManualMode(m => m === 'once' ? null : 'once')}>One time</Button>
    </div>

    {manualMode === 'weekly' && <form className="onb-manual" onSubmit={addWeekly}>
      <fieldset>
        <legend>Days</legend>
        <div className="onb-chips">{WEEKDAY_LABELS.map((d, i) =>
          <Button key={d} type="button" variant="chip" aria-pressed={weeklyDraft.weekdays.includes(i)}
            onClick={() => setWeeklyDraft(x => ({ ...x, weekdays: x.weekdays.includes(i) ? x.weekdays.filter(v => v !== i) : [...x.weekdays, i] }))}>{d}</Button>)}
        </div>
      </fieldset>
      <div className="row">
        <label>From<input type="time" value={weeklyDraft.start_time} onChange={e => setWeeklyDraft(x => ({ ...x, start_time: e.target.value }))} /></label>
        <label>To<input type="time" value={weeklyDraft.end_time} onChange={e => setWeeklyDraft(x => ({ ...x, end_time: e.target.value }))} /></label>
      </div>
      <label>Label (optional)<input maxLength="60" value={weeklyDraft.label} onChange={e => setWeeklyDraft(x => ({ ...x, label: e.target.value }))} placeholder="e.g. CPE 133 lecture" /></label>
      <Button variant="primary" disabled={busy}>Add weekly time</Button>
    </form>}

    {manualMode === 'once' && <form className="onb-manual" onSubmit={addOnce}>
      <label>Date<input type="date" value={onceDraft.date} min={new Date().toLocaleDateString('en-CA')} onChange={e => setOnceDraft(x => ({ ...x, date: e.target.value }))} /></label>
      <div className="row">
        <label>From<input type="time" value={onceDraft.start_time} onChange={e => setOnceDraft(x => ({ ...x, start_time: e.target.value }))} /></label>
        <label>To<input type="time" value={onceDraft.end_time} onChange={e => setOnceDraft(x => ({ ...x, end_time: e.target.value }))} /></label>
      </div>
      <label>Label (optional)<input maxLength="60" value={onceDraft.label} onChange={e => setOnceDraft(x => ({ ...x, label: e.target.value }))} placeholder="e.g. Midterm" /></label>
      <Button variant="primary" disabled={busy}>Block out this time</Button>
    </form>}

    {(weekly.length > 0 || manualBlocks.length > 0) && <ul className="onb-busy" aria-label="Your blocked-out times">
      {weekly.map(w => <li key={w.id}>
        <span><strong>Every {WEEKDAY_LABELS[w.weekday]}</strong> {formatTime(w.start_time)} – {formatTime(w.end_time)}{w.label && <em> · {w.label}</em>}</span>
        <Button variant="quiet" aria-label="Remove" onClick={() => run(async () => { await api.deleteWeeklyBusy(w.id); setWeekly(list => list.filter(x => x.id !== w.id)); })}>✕</Button>
      </li>)}
      {manualBlocks.map(b => <li key={b.id}>
        <span><strong>{formatRange(b)}</strong>{b.label && <em> · {b.label}</em>}</span>
        <Button variant="quiet" aria-label="Remove" onClick={() => run(async () => { await api.deleteBusyBlock(b.id); setBlocks(list => list.filter(x => x.id !== b.id)); })}>✕</Button>
      </li>)}
    </ul>}
  </div>;
}
