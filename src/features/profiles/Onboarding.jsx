import React, { useEffect, useMemo, useState } from 'react';
import { GOALS, INTEREST_GROUPS, MIN_INTERESTS } from './catalog.js';
import { WEEKDAY_LABELS, expandWeeklyBusy, validateWeeklyEntry } from './availability.js';
import { rankActivities } from './matching.js';
import * as api from './api.js';
import { supabase } from '../../lib/supabase.js';
import './onboarding.css';

const STEPS = ['name', 'interests', 'goals', 'calendar', 'matches'];

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function Chip({ selected, onClick, children }) {
  return <button type="button" className={`onb-chip${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={onClick}>{children}</button>;
}

function toggle(set, value) {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
}

export default function Onboarding({ session, profile, returnedFromGoogle, onDone }) {
  const userId = session.user.id;
  const [step, setStep] = useState(returnedFromGoogle ? 'calendar' : 'name');
  const [name, setName] = useState(profile?.display_name || '');
  const [interests, setInterests] = useState(() => new Set(profile?.interests || []));
  const [goals, setGoals] = useState(() => new Set(profile?.goals || []));
  const [weekly, setWeekly] = useState([]);
  const [googleBlocks, setGoogleBlocks] = useState([]);
  const [draft, setDraft] = useState({ weekdays: [], start_time: '', end_time: '', label: '' });
  const [manualOpen, setManualOpen] = useState(false);
  const [matches, setMatches] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function run(fn) {
    setError(''); setBusy(true);
    try { await fn(); } catch (e) { setError(e.message || 'Something went wrong.'); } finally { setBusy(false); }
  }

  const answers = () => ({ displayName: name, interests: [...interests], goals: [...goals] });

  // Load saved availability, and finish the Google sync after its redirect.
  useEffect(() => {
    run(async () => {
      const [w, g] = await Promise.all([api.loadWeeklyBusy(), api.loadGoogleBusy()]);
      setWeekly(w); setGoogleBlocks(g);
      if (returnedFromGoogle && session.provider_token) {
        const synced = await api.syncGoogleBusy(userId, session.provider_token);
        setGoogleBlocks(synced);
        setNotice(`Google Calendar connected · ${synced.length} busy ${synced.length === 1 ? 'time' : 'times'} found in the next 4 weeks`);
      } else if (returnedFromGoogle) {
        setError('Google didn’t share calendar access. Try connecting again.');
      }
    });
  }, []);

  const busyBlocks = useMemo(() => [...googleBlocks, ...expandWeeklyBusy(weekly)], [googleBlocks, weekly]);

  useEffect(() => {
    if (step !== 'matches') return;
    run(async () => {
      const { games, roster } = await api.loadMatchInputs();
      setMatches(rankActivities(games, { id: userId, interests: [...interests], goals: [...goals] }, { busyBlocks, roster, limit: 5 }));
    });
  }, [step]);

  async function next() {
    const i = STEPS.indexOf(step);
    if (step !== 'calendar' && step !== 'matches') {
      await run(() => api.saveOnboarding(userId, answers()));
    }
    setError(''); setNotice('');
    setStep(STEPS[i + 1]);
  }

  async function finish() {
    await run(async () => onDone(await api.saveOnboarding(userId, answers(), true)));
  }

  async function addManual(e) {
    e.preventDefault();
    const problem = validateWeeklyEntry(draft);
    if (problem) return setError(problem);
    await run(async () => {
      const rows = await api.addWeeklyBusy(userId, draft);
      setWeekly(w => [...w, ...rows].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)));
      setDraft({ weekdays: [], start_time: '', end_time: '', label: '' });
    });
  }

  async function join(gameId) {
    await run(async () => {
      const { error: joinError } = await supabase.rpc('join_game', { p_game_id: gameId });
      if (joinError) throw joinError;
      setMatches(m => m.map(x => x.game.id === gameId ? { ...x, joined: true } : x));
    });
  }

  const index = STEPS.indexOf(step);
  const canContinue = step === 'name' ? name.trim().length > 0
    : step === 'interests' ? interests.size >= MIN_INTERESTS
    : step === 'goals' ? goals.size > 0 : true;

  return <main className="onb">
    <header className="onb-top">
      {index > 0 && step !== 'matches'
        ? <button type="button" className="quiet" onClick={() => setStep(STEPS[index - 1])} aria-label="Back">‹ Back</button>
        : <span />}
      <div className="onb-progress" role="progressbar" aria-valuemin="1" aria-valuemax={STEPS.length} aria-valuenow={index + 1}>
        {STEPS.map((s, i) => <span key={s} className={i <= index ? 'done' : ''} />)}
      </div>
      <button type="button" className="quiet" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </header>

    {error && <p role="alert" className="alert">{error}</p>}
    {notice && <p role="status" className="onb-notice">{notice}</p>}

    {step === 'name' && <section>
      <small>WELCOME TO TOGO</small>
      <h2>First, what should people call you?</h2>
      <label>Display name<input autoFocus maxLength="80" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></label>
    </section>}

    {step === 'interests' && <section>
      <small>STEP 2 OF 5</small>
      <h2>What are you into?</h2>
      <p>Pick at least {MIN_INTERESTS}. We’ll use these to find activities for you.</p>
      {INTEREST_GROUPS.map(group => <div key={group.title} className="onb-group">
        <h3>{group.title}</h3>
        <div className="onb-chips">{group.items.map(item =>
          <Chip key={item} selected={interests.has(item)} onClick={() => setInterests(s => toggle(s, item))}>{item}</Chip>)}
        </div>
      </div>)}
    </section>}

    {step === 'goals' && <section>
      <small>STEP 3 OF 5</small>
      <h2>What do you want out of ToGo?</h2>
      <p>Choose any that fit.</p>
      <div className="onb-goals">{GOALS.map(g =>
        <button type="button" key={g.id} aria-pressed={goals.has(g.id)} className={`onb-goal${goals.has(g.id) ? ' selected' : ''}`} onClick={() => setGoals(s => toggle(s, g.id))}>
          <span aria-hidden="true">{g.emoji}</span>{g.label}
        </button>)}
      </div>
    </section>}

    {step === 'calendar' && <section>
      <small>STEP 4 OF 5</small>
      <h2>When are you free?</h2>
      <p>We’ll only suggest activities that fit around your schedule. We only see when you’re busy, never what your events are.</p>
      <div className="onb-option">
        <div>
          <strong>Google Calendar</strong>
          <span>{googleBlocks.length ? `Connected · ${googleBlocks.length} busy times synced` : 'Sync your busy times automatically'}</span>
        </div>
        <button type="button" className={googleBlocks.length ? 'secondary' : ''} disabled={busy} onClick={() => run(api.connectGoogleCalendar)}>
          {googleBlocks.length ? 'Sync again' : 'Connect'}
        </button>
      </div>
      <div className="onb-option">
        <div>
          <strong>Add times manually</strong>
          <span>Classes, work shifts, or anything weekly</span>
        </div>
        <button type="button" className="secondary" onClick={() => setManualOpen(o => !o)}>{manualOpen ? 'Close' : 'Add'}</button>
      </div>
      {manualOpen && <form className="onb-manual" onSubmit={addManual}>
        <fieldset>
          <legend>Days</legend>
          <div className="onb-chips">{WEEKDAY_LABELS.map((d, i) =>
            <Chip key={d} selected={draft.weekdays.includes(i)} onClick={() => setDraft(x => ({ ...x, weekdays: x.weekdays.includes(i) ? x.weekdays.filter(v => v !== i) : [...x.weekdays, i] }))}>{d}</Chip>)}
          </div>
        </fieldset>
        <div className="row">
          <label>From<input type="time" value={draft.start_time} onChange={e => setDraft(x => ({ ...x, start_time: e.target.value }))} /></label>
          <label>To<input type="time" value={draft.end_time} onChange={e => setDraft(x => ({ ...x, end_time: e.target.value }))} /></label>
        </div>
        <label>Label (optional)<input maxLength="60" value={draft.label} onChange={e => setDraft(x => ({ ...x, label: e.target.value }))} placeholder="e.g. CPE 133 lecture" /></label>
        <button disabled={busy}>Add busy time</button>
      </form>}
      {weekly.length > 0 && <ul className="onb-busy">{weekly.map(w =>
        <li key={w.id}>
          <span><strong>{WEEKDAY_LABELS[w.weekday]}</strong> {formatTime(w.start_time)} – {formatTime(w.end_time)}{w.label && <em> · {w.label}</em>}</span>
          <button type="button" className="quiet" aria-label="Remove" onClick={() => run(async () => { await api.deleteWeeklyBusy(w.id); setWeekly(list => list.filter(x => x.id !== w.id)); })}>✕</button>
        </li>)}
      </ul>}
    </section>}

    {step === 'matches' && <section>
      <small>YOU’RE ALL SET</small>
      <h2>Picked for you</h2>
      <p>Based on your interests{busyBlocks.length ? ' and schedule' : ''}.</p>
      {matches === null ? <p>Finding activities…</p>
        : matches.length === 0 ? <p className="empty">No matches yet. New activities are posted all the time, so check back soon or host your own.</p>
        : <div className="onb-matches">{matches.map(m =>
          <article key={m.game.id} className="onb-match">
            <div className="onb-match-head">
              <small>{m.game.sport.toUpperCase()}</small>
              <span className="onb-score">{Math.min(99, Math.round(m.score * 100 / 125))}% match</span>
            </div>
            <h3>{m.game.title}</h3>
            <p>📍 {m.game.venue}<br />◷ {new Date(m.game.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
            <ul className="onb-reasons">{m.reasons.map(r => <li key={r}>{r}</li>)}</ul>
            <button type="button" disabled={busy || m.joined} onClick={() => join(m.game.id)}>{m.joined ? 'Joined ✓' : 'Join activity'}</button>
          </article>)}
        </div>}
    </section>}

    <footer className="onb-footer">
      {step === 'matches'
        ? <button type="button" disabled={busy} onClick={finish}>Go to ToGo</button>
        : <button type="button" disabled={busy || !canContinue} onClick={next}>
            {step === 'calendar' && !busyBlocks.length ? 'Skip for now' : 'Continue'}
          </button>}
    </footer>
  </main>;
}
