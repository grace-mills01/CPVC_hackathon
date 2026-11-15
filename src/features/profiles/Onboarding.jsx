import React, { useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import { GOALS, INTEREST_GROUPS, MIN_INTERESTS } from './catalog.js';
import { rankActivities } from './matching.js';
import AvailabilityEditor from './AvailabilityEditor.jsx';
import * as api from './api.js';
import { supabase } from '../../lib/supabase.js';
import './onboarding.css';

const STEPS = ['name', 'interests', 'goals', 'calendar', 'matches'];

function toggle(set, value) {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
}

function GoalPicker({ goals, setGoals }) {
  return <div className="onb-goals">{GOALS.map(g =>
    <Button key={g.id} variant="choice" aria-pressed={goals.has(g.id)} onClick={() => setGoals(s => toggle(s, g.id))}>
      <span aria-hidden="true">{g.emoji}</span>{g.label}
    </Button>)}
  </div>;
}

/**
 * New-user setup. With `editStep` it opens on that one step (from the Profile
 * page) and its footer button saves and closes instead of continuing.
 */
export default function Onboarding({ session, profile, returnedFromGoogle, editStep = null, onDone }) {
  const userId = session.user.id;
  const [step, setStep] = useState(returnedFromGoogle ? 'calendar' : editStep || 'name');
  const [name, setName] = useState(profile?.display_name || '');
  const [interests, setInterests] = useState(() => new Set(profile?.interests || []));
  const [goals, setGoals] = useState(() => new Set(profile?.goals || []));
  const [busyBlocks, setBusyBlocks] = useState([]);
  const [matches, setMatches] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Returning from Google for someone already onboarded means they came from the Profile page.
  const editing = Boolean(editStep) || (returnedFromGoogle && Boolean(profile?.onboarded_at));

  async function run(fn) {
    setError(''); setBusy(true);
    try { await fn(); } catch (e) { setError(e.message || 'Something went wrong.'); } finally { setBusy(false); }
  }

  const answers = () => ({ displayName: name, interests: [...interests], goals: [...goals] });

  useEffect(() => {
    if (step !== 'matches') return;
    run(async () => {
      const { games, roster } = await api.loadMatchInputs();
      setMatches(rankActivities(games, { id: userId, interests: [...interests], goals: [...goals] }, { busyBlocks, roster, limit: 5 }));
    });
  }, [step]);

  async function next() {
    if (step !== 'calendar') await run(() => api.saveOnboarding(userId, answers()));
    setError('');
    setStep(STEPS[STEPS.indexOf(step) + 1]);
  }

  async function finish() {
    await run(async () => onDone(await api.saveOnboarding(userId, answers(), true)));
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
    : step === 'interests' ? interests.size >= MIN_INTERESTS && (!editing || goals.size > 0)
    : step === 'goals' ? goals.size > 0 : true;

  return <main className="onb">
    <header className="onb-top">
      {editing
        ? <Button variant="quiet" onClick={() => onDone(null)}>‹ Profile</Button>
        : index > 0 && step !== 'matches'
          ? <Button variant="quiet" onClick={() => setStep(STEPS[index - 1])}>‹ Back</Button>
          : <span />}
      {editing
        ? <span />
        : <div className="onb-progress" role="progressbar" aria-valuemin="1" aria-valuemax={STEPS.length} aria-valuenow={index + 1}>
            {STEPS.map((s, i) => <span key={s} className={i <= index ? 'done' : ''} />)}
          </div>}
      {editing ? <span /> : <Button variant="quiet" onClick={() => supabase.auth.signOut()}>Sign out</Button>}
    </header>

    {error && <p role="alert" className="alert">{error}</p>}

    {step === 'name' && <section>
      <small>WELCOME TO TOGO</small>
      <h2>First, what should people call you?</h2>
      <label>Display name<input autoFocus maxLength="80" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></label>
    </section>}

    {step === 'interests' && <section>
      <small>{editing ? 'YOUR INTERESTS' : 'STEP 2 OF 5'}</small>
      <h2>What are you into?</h2>
      <p>Pick at least {MIN_INTERESTS}. We’ll use these to find activities for you.</p>
      {INTEREST_GROUPS.map(group => <div key={group.title} className="onb-group">
        <h3>{group.title}</h3>
        <div className="onb-chips">{group.items.map(item =>
          <Button key={item} variant="chip" aria-pressed={interests.has(item)} onClick={() => setInterests(s => toggle(s, item))}>{item}</Button>)}
        </div>
      </div>)}
      {editing && <>
        <h2 className="onb-subhead">What do you want out of ToGo?</h2>
        <GoalPicker goals={goals} setGoals={setGoals} />
      </>}
    </section>}

    {step === 'goals' && <section>
      <small>STEP 3 OF 5</small>
      <h2>What do you want out of ToGo?</h2>
      <p>Choose any that fit.</p>
      <GoalPicker goals={goals} setGoals={setGoals} />
    </section>}

    {step === 'calendar' && <section>
      <small>{editing ? 'YOUR AVAILABILITY' : 'STEP 4 OF 5'}</small>
      <h2>When are you free?</h2>
      <p>We’ll only suggest activities that fit around your schedule. We only see when you’re busy, never what your events are.</p>
      <AvailabilityEditor session={session} returnedFromGoogle={returnedFromGoogle} onBusyChange={setBusyBlocks} />
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
            <Button variant={m.joined ? 'hosting' : 'join'} disabled={busy || m.joined} onClick={() => join(m.game.id)}>{m.joined ? 'Joined ✓' : 'Join activity'}</Button>
          </article>)}
        </div>}
    </section>}

    <footer className="onb-footer">
      {editing || step === 'matches'
        ? <Button variant="primary" disabled={busy || !canContinue} onClick={finish}>{editing ? 'Save' : 'Go to ToGo'}</Button>
        : <Button variant="primary" disabled={busy || !canContinue} onClick={next}>
            {step === 'calendar' && !busyBlocks.length ? 'Skip for now' : 'Continue'}
          </Button>}
    </footer>
  </main>;
}
