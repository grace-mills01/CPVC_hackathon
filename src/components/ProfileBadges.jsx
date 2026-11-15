import React from 'react';
import Button from './Button.jsx';
import { activityBadges } from '../lib/badges.js';
import './profile-badges.css';

const drawings = {
  basketball: <><circle cx="24" cy="24" r="17"/><path d="M7 24h34M24 7v34M12 12c16 2 22 10 24 24M36 12c-16 2-22 10-24 24"/></>,
  volleyball: <><circle cx="24" cy="24" r="17"/><path d="m24 24 16-6M24 24 13 11m11 13-4 17M17 8c3 5 5 9 7 16M39 30c-6 1-11-1-15-6M9 32c3-5 8-7 15-8"/></>,
  soccer: <><circle cx="24" cy="24" r="17"/><path d="m24 16 8 6-3 9H19l-3-9Zm0 0V7m8 15 8-4m-11 13 5 7m-15-7-5 7m2-16-8-4"/></>,
  football: <><path d="M8 37C3 18 18 3 38 9c6 19-9 34-30 28Z"/><path d="m16 30 15-15m-14 8 8 8m-2-14 8 8M8 28l12 12M28 8l12 12"/></>,
  paddle: <><path d="M16 29C1 15 17 1 30 11s5 22-6 22l-9 11-6-5Z"/><circle cx="37" cy="37" r="5"/><path d="m16 29 8 4"/></>,
  shuttle: <><path d="m13 29-5-18 9 3 7-7 7 7 9-3-5 18Zm0 0v5a11 11 0 0 0 22 0v-5M17 14l3 15m11-15-3 15m-4-22v22"/></>,
  racket: <><ellipse cx="29" cy="18" rx="11" ry="15" transform="rotate(35 29 18)"/><path d="m20 30-11 14-5-4 12-14m4-17 15 15m-11-19 14 14m-19 1 15-10m-13 16 16-11"/></>,
  ball: <><circle cx="24" cy="24" r="16"/><path d="M10 17c12-1 19 6 21 21M17 10c0 10 9 19 21 20"/></>,
  disc: <><ellipse cx="24" cy="25" rx="19" ry="9" transform="rotate(-20 24 25)"/><ellipse cx="24" cy="23" rx="12" ry="4" transform="rotate(-20 24 23)"/><path d="m7 10 10-3M3 17l10-3"/></>,
  shoe: <><path d="m8 15 10 5 6-7 5 13 12 5v8H7V25Zm-1 19h34M23 22l6-2m-3 8 6-3"/></>,
  waves: <><circle cx="32" cy="12" r="4"/><path d="m10 23 11-9 9 9m-9-9-6-5-8 3M5 31q5-6 10 0t10 0 10 0 8 0M5 40q5-6 10 0t10 0 10 0 8 0"/></>,
  mountain: <><path d="m5 40 14-29 8 15 6-11 11 25Zm8-17 6 4 5-5m5 1 4 4 4-4"/><circle cx="35" cy="7" r="3"/></>,
  trail: <><path d="m5 29 9-16 7 12 9-18 13 22M27 28c-20 2 16 9-5 15M8 43h6"/></>,
  cup: <><path d="M9 17h24v14a10 10 0 0 1-10 10h-4A10 10 0 0 1 9 31Zm24 2h4a6 6 0 0 1 0 12h-4M15 6v5m8-7v7m8-5v5"/></>,
  utensils: <><path d="M11 7v13m6-13v13M5 7v13c0 7 12 7 12 0M11 26v16M35 7c-9 7-9 16 0 18V7Zm0 18v17"/></>,
  city: <><path d="M5 41V20h12v21m0 0V8h14v33m0 0V23h12v18M22 15h4m-4 8h4m-4 8h4M9 27h4m22 3h4M3 41h42"/></>,
  palette: <><path d="M41 27C48 7 12 1 7 19c-6 20 20 30 23 18 2-8 8-1 11-10Z"/><circle cx="17" cy="16" r="2"/><circle cx="28" cy="13" r="2"/><circle cx="36" cy="20" r="2"/><circle cx="15" cy="28" r="2"/></>,
  bike: <><circle cx="12" cy="32" r="9"/><circle cx="37" cy="32" r="9"/><path d="m12 32 9-17 7 17H12m16 0 7-20h-6M17 15h9m9-3h5"/></>,
  fitness: <><path d="M16 24h16M7 16h9v16H7Zm25 0h9v16h-9ZM3 20v8m42-8v8"/></>,
  music: <><path d="M20 34V12l19-5v22M20 19l19-5"/><ellipse cx="14" cy="35" rx="6" ry="5"/><ellipse cx="33" cy="30" rx="6" ry="5"/></>,
  hat: <><path d="m12 29 4-18h16l5 18M5 33c8-7 30-7 38 0-7 9-30 9-38 0ZM15 23h19"/><path d="m24 13 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/></>,
  heart: <path d="M24 40 8 24C-5 10 15-1 24 13 33-1 53 10 40 24Z"/>,
  pin: <><path d="M38 20c0 10-14 23-14 23S10 30 10 20a14 14 0 0 1 28 0Z"/><circle cx="24" cy="20" r="5"/></>,
  calendar: <><rect x="7" y="10" width="34" height="32" rx="4"/><path d="M15 6v8m18-8v8M7 21h34m-25 9 6 6 12-11"/></>,
  clock: <><circle cx="24" cy="24" r="13"/><path d="M24 15v10l7 4M19 7h10"/></>,
  flag: <><path d="M15 39V10m0 2c8-6 12 6 22 0v15c-10 6-14-6-22 0"/></>,
  star: <path d="m24 8 5 10 11 2-8 8 2 12-10-6-10 6 2-12-8-8 11-2Z"/>,
  spark: <><path d="m24 9 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z"/><path d="M37 7v6m-3-3h6"/></>,
  people: <><circle cx="24" cy="17" r="6"/><path d="M13 37v-4a11 11 0 0 1 22 0v4M9 16a5 5 0 0 0 0 10m30-10a5 5 0 0 1 0 10M5 36v-4m38 4v-4"/></>,
  moon: <><path d="M31 9a16 16 0 1 0 9 25A17 17 0 0 1 31 9Z"/><path d="M12 8v6m-3-3h6m22 5v6m-3-3h6"/></>,
  sun: <><circle cx="24" cy="24" r="9"/><path d="M24 5v5m0 28v5M5 24h5m28 0h5M10 10l4 4m20 20 4 4m0-28-4 4M14 34l-4 4"/></>,
  book: <><path d="M24 14c-5-5-12-5-17-3v25c6-2 12-1 17 3 5-4 11-5 17-3V11c-5-2-12-2-17 3v25M12 18l7 2m10 0 7-2"/></>,
  compass: <><circle cx="24" cy="24" r="17"/><path d="m31 17-4 10-10 4 4-10Z"/></>,
};
export function BadgeEmblem({badge}) {
  return <div className={`achievement achievement--${badge.tone} badge-emblem-only`} aria-hidden="true"><div className="achievement-emblem"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{drawings[badge.icon] || drawings.spark}</svg><span>✓</span></div></div>;
}
export default function ProfileBadges({games, roster, userId, gallery = false, onShowAll}) {
  const {earned} = activityBadges(games, roster, userId);
  return <section className="profile-badges" aria-labelledby="profile-badges-title">
    <div className="profile-badges-heading"><div><h3 id="profile-badges-title">A little proof you showed up.</h3><p>Your experiences, collected.</p></div><div className="profile-badges-actions"><span className="profile-badges-count">{earned.length} earned</span>{!gallery && earned.length > 0 && <Button variant="secondary" onClick={onShowAll}>Show all <span aria-hidden="true">→</span></Button>}</div></div>
    {earned.length ? <ul className={gallery ? "profile-badges-grid" : "profile-badges-row"} aria-label={gallery ? "All earned badges" : "Earned badges"} tabIndex={gallery ? undefined : 0}>{earned.map(badge => <li className={`achievement achievement--${badge.tone}`} key={badge.id}>
      <div className="achievement-emblem" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{drawings[badge.icon]}</svg><span>✓</span></div>
      <h4>{badge.name}</h4><span className="achievement-detail">{badge.detail}</span>{gallery && <p>{badge.description}</p>}
    </li>)}</ul> : <div className="profile-badges-empty"><span aria-hidden="true">✦</span><h4>Your story starts with one activity.</h4><p>Complete your first activity to earn its emblem. Keep exploring for hosting, hours, and a few unexpected achievements.</p></div>}
    {gallery && <details className="profile-badges-guide"><summary>How badges are earned</summary><p>Collect an emblem for every new activity type, every 50 hours, every 10 activities hosted, and every 15 activities participated in. Hosting also counts as participation. Earn crowd badges at 5, 10, 25, 50, and 100 people.</p><p>Discover special badges for five study sessions, five activity types, starts after 11 pm or before 5 am, three types in one day, five activities with the same person, five venues, or both days of one weekend. Calendar and time achievements use Pacific time.</p><p>Only completed activities count. Hours require a recorded end time; attendance and crowd size use the saved roster.</p></details>}
  </section>;
}
