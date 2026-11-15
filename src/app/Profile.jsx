import Button from '../components/Button.jsx';
import React from 'react';
import ProfileBadges from '../components/ProfileBadges.jsx';
import { profileActivity } from '../lib/profile.js';
import { editPreferences } from '../features/profiles/OnboardingGate.jsx';

export default function Profile({profile, games, roster, userId, onEdit, onOpen, onDiscover}) {
  const {upcoming, sports, sessions} = profileActivity(games, roster, userId);
  const initials = profile.display_name.trim().split(/\s+/).slice(0,2).map(word => word[0]).join('');
  return <section className="profile-page" aria-label="Your profile">
    <Button variant="icon" className="profile-settings" onClick={onEdit} aria-label="Edit profile">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></svg>
    </Button>
    <div className="profile-identity">
      {profile.avatar_url ? <img className="profile-photo" src={profile.avatar_url} alt={profile.display_name}/> : <div className="profile-photo profile-initials" aria-label="Profile photo placeholder">{initials || 'T'}</div>}
      <h2>{profile.display_name}</h2>
      <p className="profile-community">Cal Poly · SLO</p>
      <p className="profile-tagline">{profile.bio || 'Your next connection starts here.'}</p>
    </div>
    <dl className="profile-stats">
      {[[sports,'Activities tried'],[sessions,'Sessions']].map(([value,label]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <ProfileBadges games={games} roster={roster} userId={userId}/>
    <section className="profile-upcoming" aria-labelledby="profile-upcoming-title">
      <h3 id="profile-upcoming-title">Upcoming</h3>
      <div className="profile-plans">{upcoming.map(game => <Button variant="plan" className="profile-plan" key={game.id} onClick={()=>onOpen(game)}>
        <span className={`profile-plan-thumb ${/beach|volley/i.test(game.sport) ? 'profile-plan-beach' : ''}`} aria-hidden="true">{game.image_url ? <img src={game.image_url} alt=""/> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m4 4h4"/></svg>}</span>
        <span className="profile-plan-copy"><strong>{game.title}</strong><span>{new Date(game.starts_at).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})} · {new Date(game.starts_at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})} · {game.venue}</span></span>
        <span className="profile-plan-arrow" aria-hidden="true">›</span>
      </Button>)}</div>
      {!upcoming.length && <div className="profile-empty"><p>No upcoming plans yet.</p><Button variant="secondary" onClick={onDiscover}>Find an activity</Button></div>}
    </section>
    <section className="profile-preferences" aria-labelledby="profile-preferences-title">
      <h3 id="profile-preferences-title">Matching</h3>
      <div className="profile-plans">{[
        ['interests', 'Interests & goals', profile.interests?.length ? profile.interests.slice(0, 3).join(' · ') + (profile.interests.length > 3 ? ` +${profile.interests.length - 3}` : '') : 'Tell us what you’re into'],
        ['calendar', 'Calendar & availability', 'Sync Google or Apple Calendar, or block out times']
      ].map(([step, title, detail]) => <Button variant="plan" className="profile-plan" key={step} onClick={() => editPreferences(step)}>
        <span className="profile-plan-copy"><strong>{title}</strong><span>{detail}</span></span>
        <span className="profile-plan-arrow" aria-hidden="true">›</span>
      </Button>)}</div>
    </section>
    <section className="profile-about" aria-labelledby="profile-about-title"><h3 id="profile-about-title">About Me</h3><p>{profile.bio || 'Add a bio to let people know what you’re up for.'}</p></section>
  </section>;
}
