import React, { useEffect, useRef, useState } from 'react';
import Button from '../../components/Button.jsx';
import { PREFERENCES_SAVED_EVENT, editPreferences } from '../profiles/OnboardingGate.jsx';
import * as api from './api.js';
import './for-you.css';

const when = iso => new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function timeAgo(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;
}

/**
 * "For you" on Home: AI-picked activities with a personal reason each, a
 * "Not for me" button that teaches the picker, and a notification bell.
 */
export default function ForYou({ games, roster, userId, onOpen, onJoin }) {
  const [state, setState] = useState({ status: 'loading', recs: [], ai: false, needsPreferences: false });
  const [notifications, setNotifications] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);

  // Refetch when the user's joined activities or the set of activities change.
  const joinedKey = roster.filter(r => r.user_id === userId).map(r => r.game_id).sort().join(',');
  const gamesKey = games.map(g => `${g.id}:${g.status}`).join(',');

  async function load(force = false) {
    const id = ++request.current;
    setError('');
    try {
      const data = await api.fetchRecommendations({ force });
      if (id !== request.current) return;
      setState({ status: 'ready', recs: data.recommendations || [], ai: Boolean(data.ai), needsPreferences: Boolean(data.needs_preferences) });
      setNotifications(await api.loadNotifications());
    } catch (e) {
      if (id !== request.current) return;
      setState(s => ({ ...s, status: 'ready' }));
      setError(e.message);
    }
  }

  useEffect(() => { const t = setTimeout(() => load(), 300); return () => clearTimeout(t); }, [joinedKey, gamesKey]);
  useEffect(() => {
    const refresh = () => { setState(s => ({ ...s, status: 'loading' })); load(true); };
    window.addEventListener(PREFERENCES_SAVED_EVENT, refresh);
    return () => window.removeEventListener(PREFERENCES_SAVED_EVENT, refresh);
  }, []);

  const byId = new Map(games.map(g => [g.id, g]));
  const picks = state.recs.map(r => ({ ...r, game: byId.get(r.game_id) })).filter(r => r.game);
  const unread = notifications.filter(n => !n.read_at);

  async function togglePanel() {
    const opening = !panelOpen;
    setPanelOpen(opening);
    if (opening && unread.length) {
      try {
        await api.markNotificationsRead(unread.map(n => n.id));
        setNotifications(list => list.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }));
      } catch { /* the badge just stays until next load */ }
    }
  }

  async function dismiss(gameId) {
    setState(s => ({ ...s, recs: s.recs.filter(r => r.game_id !== gameId) }));
    try { await api.dismissRecommendation(gameId); load(true); } catch (e) { setError(e.message); }
  }

  return <section className="for-you" aria-labelledby="for-you-title">
    <div className="for-you-head">
      <div>
        <small>{state.ai ? '✦ AI PICKS' : 'PICKED FOR YOU'}</small>
        <h3 id="for-you-title">For you</h3>
        <p>{state.ai ? 'Chosen by AI from your interests, goals, and free time.' : 'Based on your interests, goals, and free time.'}</p>
      </div>
      <Button variant="icon" className="for-you-bell" aria-label={unread.length ? `Notifications, ${unread.length} new` : 'Notifications'} aria-expanded={panelOpen} onClick={togglePanel}>
        <BellIcon />
        {unread.length > 0 && <span className="for-you-badge" aria-hidden="true">{unread.length > 9 ? '9+' : unread.length}</span>}
      </Button>
    </div>

    {panelOpen && <div className="for-you-panel" role="region" aria-label="Notifications">
      {notifications.length === 0
        ? <p className="for-you-panel-empty">No notifications yet. We’ll let you know when something that fits you opens up.</p>
        : notifications.map(n => {
          const game = byId.get(n.game_id);
          return <Button key={n.id} variant="notice" className={`for-you-notice${n.read_at ? '' : ' unread'}`} disabled={!game}
            onClick={() => { if (game) { setPanelOpen(false); onOpen(game); } }}>
            <strong>{n.title}</strong>
            <span>{n.body}</span>
            <small>{timeAgo(n.created_at)}</small>
          </Button>;
        })}
    </div>}

    {error && <p role="alert" className="alert">{error}</p>}

    {state.status === 'loading'
      ? <div className="for-you-row" aria-busy="true" aria-label="Finding your picks">{[0, 1].map(i => <div key={i} className="for-you-card for-you-skeleton" />)}</div>
      : state.needsPreferences
        ? <div className="for-you-empty"><p>Tell us what you’re into and we’ll pick activities for you.</p><Button variant="secondary" onClick={() => editPreferences('interests')}>Add your interests</Button></div>
        : picks.length === 0
          ? <div className="for-you-empty"><p>Nothing new fits your interests and schedule right now. We’ll notify you when something does.</p></div>
          : <div className="for-you-row">{picks.map(p => <article key={p.game_id} className="for-you-card">
            <Button variant="card" className="for-you-open" onClick={() => onOpen(p.game)}>
              <span className="for-you-meta"><span className="for-you-type">{p.game.sport}</span><span className="for-you-fit">{p.fit}% match</span></span>
              <strong className="for-you-title">{p.game.title}</strong>
              <span className="for-you-when">{when(p.game.starts_at)} · {p.game.venue}</span>
              <span className="for-you-reason">{p.source === 'ai' && <span className="for-you-spark" aria-label="AI">✦</span>}{p.reason}</span>
            </Button>
            <div className="for-you-actions">
              <Button variant="join" onClick={() => onJoin(p.game)}>Join</Button>
              <Button variant="quiet" onClick={() => dismiss(p.game_id)}>Not for me</Button>
            </div>
          </article>)}</div>}
  </section>;
}
