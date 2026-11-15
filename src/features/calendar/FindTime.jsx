import React, { useRef, useState } from 'react';
import Button from '../../components/Button.jsx';
import { supabase } from '../../lib/supabase.js';
import './calendar.css';

/** ISO time → value for <input type="datetime-local"> in the viewer's time zone. */
const toLocalInput = iso => {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * "Find the best time" inside the Create activity form. Reads the activity
 * type, title, and details already typed, asks the suggest-times function when
 * the most interested people are free, and fills the date field on tap.
 */
export default function FindTime() {
  const root = useRef(null);
  const [state, setState] = useState({ status: 'idle', suggestions: [], message: '', interested: null });
  const [chosen, setChosen] = useState(null);

  const form = () => root.current?.closest('form');

  async function find() {
    const f = form();
    const field = name => f?.elements.namedItem(name)?.value?.trim() || '';
    if (!field('sport')) { setState({ status: 'done', suggestions: [], message: 'Pick an activity type first, then we can find a time.', interested: null }); return; }
    setState(s => ({ ...s, status: 'loading', message: '' }));
    setChosen(null);
    const { data, error } = await supabase.functions.invoke('suggest-times', {
      body: { sport: field('sport'), title: field('title'), description: field('description'), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    });
    if (error) {
      let message = 'Couldn’t check times right now. Try again in a moment.';
      try { message = (await error.context.json()).error || message; } catch { /* keep default */ }
      setState({ status: 'done', suggestions: [], message, interested: null });
      return;
    }
    setState({ status: 'done', suggestions: data.suggestions || [], message: data.message || '', interested: data.interested });
  }

  function use(s) {
    const input = form()?.elements.namedItem('time');
    if (!input) return;
    // Set the value the way React expects so the uncontrolled input keeps it.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, toLocalInput(s.starts_at));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    setChosen(s.starts_at);
  }

  return <div className="find-time" ref={root}>
    <Button type="button" variant="suggest" disabled={state.status === 'loading'} onClick={find}>
      {state.status === 'loading' ? 'Checking schedules…' : '✦ Find the best time'}
    </Button>
    {state.status === 'done' && <div className="find-time-results" aria-live="polite">
      {state.interested && <p className="find-time-intro">{state.interested} people are likely interested. Times when the most of them are free:</p>}
      {state.suggestions.map(s => <Button key={s.starts_at} type="button" variant="chip" aria-pressed={chosen === s.starts_at} className="find-time-option" onClick={() => use(s)}>
        <strong>{s.label}</strong><span>{s.detail}</span>
      </Button>)}
      {state.message && <p className="find-time-note">{state.message}</p>}
      {chosen && <p className="find-time-note">Time filled in above. You can still change it.</p>}
    </div>}
  </div>;
}
