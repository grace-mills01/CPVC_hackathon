import React, { useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import * as api from './api.js';
import './calendar.css';

/**
 * "Show your ToGo plans in your calendar": a personal feed link that Google,
 * Apple, or Outlook Calendar subscribe to, so joined and hosted activities
 * appear (and update) automatically.
 */
export default function CalendarSubscribe({ userId }) {
  const [links, setLinks] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getFeedToken(userId).then(t => setLinks(api.feedLinks(t)), e => setError(e.message));
  }, [userId]);

  async function copy() {
    try { await navigator.clipboard.writeText(links.https); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError('Couldn’t copy. Press and hold the link to copy it.'); }
  }

  async function reset() {
    try { setLinks(api.feedLinks(await api.resetFeedToken(userId))); }
    catch (e) { setError(e.message); }
  }

  return <section className="calendar-subscribe" aria-labelledby="calendar-subscribe-title">
    <h3 id="calendar-subscribe-title" className="avail-heading">Show your ToGo plans in your calendar</h3>
    <p className="avail-note">Subscribe once and everything you join or host appears in your calendar automatically, including changes and cancellations.</p>
    {error && <p role="alert" className="alert">{error}</p>}
    <div className="calendar-subscribe-buttons">
      <Button variant="calendar" disabled={!links} onClick={() => window.open(links.google, '_blank', 'noopener')}>Google Calendar</Button>
      <Button variant="calendar" disabled={!links} onClick={() => { window.location.href = links.webcal; }}>Apple Calendar</Button>
      <Button variant="calendar" disabled={!links} onClick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</Button>
    </div>
    <p className="avail-note">Outlook: Add calendar → Subscribe from web, then paste the link. Google refreshes subscribed calendars every few hours; Apple refreshes more often. This link is private. If you shared it by accident, <Button variant="link" onClick={reset}>reset it</Button>.</p>
  </section>;
}
