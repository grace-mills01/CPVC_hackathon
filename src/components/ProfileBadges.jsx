import React from 'react';
import { activityBadges } from '../lib/badges.js';
import './profile-badges.css';

const drawings = {
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
export default function ProfileBadges({games, roster, userId}) {
  const {earned} = activityBadges(games, roster, userId);
  return <section className="profile-badges" aria-labelledby="profile-badges-title">
    <div className="profile-badges-heading"><div><h3 id="profile-badges-title">A little proof you showed up.</h3><p>Your experiences, collected.</p></div><span className="profile-badges-count">{earned.length} earned</span></div>
    {earned.length ? <ul className="profile-badges-grid">{earned.map(badge => <li className={`achievement achievement--${badge.tone}`} key={badge.id}>
      <div className="achievement-emblem" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{drawings[badge.icon]}</svg><span>✓</span></div>
      <h4>{badge.name}</h4><span className="achievement-detail">{badge.detail}</span><p>{badge.description}</p>
    </li>)}</ul> : <div className="profile-badges-empty"><span aria-hidden="true">✦</span><h4>Your story starts with one activity.</h4><p>Complete your first activity to earn its emblem. Keep exploring for hosting, hours, and a few unexpected achievements.</p></div>}
    <details className="profile-badges-guide"><summary>How badges are earned</summary><p>Collect an emblem for every new activity type, every 50 hours, every 10 activities hosted, and every 15 activities participated in. Hosting also counts as participation. Earn crowd badges at 5, 10, 25, 50, and 100 people.</p><p>There are surprises, too: five study sessions, five different activity types, a start after 11 pm, or a start before 5 am (Pacific time).</p><p>Only completed activities count. Hours require a recorded end time; attendance and crowd size use the saved roster.</p></details>
  </section>;
}
