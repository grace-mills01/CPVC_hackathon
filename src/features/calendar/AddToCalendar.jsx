import React from 'react';
import Button from '../../components/Button.jsx';
import { buildCalendar, googleCalendarUrl } from '../../../supabase/functions/_shared/ics-export.js';
import './calendar.css';

const fileName = title => `${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'togo-activity'}.ics`;

/** "Add to calendar" buttons for one activity (shown after joining or when hosting). */
export default function AddToCalendar({ game }) {
  const siteUrl = window.location.origin;

  function downloadIcs() {
    const blob = new Blob([buildCalendar([game], { name: game.title, siteUrl })], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName(game.title);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="add-to-calendar" role="group" aria-label="Add to your calendar">
    <span className="add-to-calendar-label">Add to your calendar</span>
    <div className="add-to-calendar-buttons">
      <Button variant="calendar" onClick={() => window.open(googleCalendarUrl(game, { siteUrl }), '_blank', 'noopener')}>Google</Button>
      <Button variant="calendar" onClick={downloadIcs}>Apple / Outlook</Button>
    </div>
  </div>;
}
