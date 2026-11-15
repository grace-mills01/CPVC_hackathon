import React from 'react';
import Button from '../components/Button.jsx';
import ProfileBadges from '../components/ProfileBadges.jsx';

export default function BadgeGallery({games, roster, userId, onBack}) {
  return <section className="badge-gallery" aria-labelledby="badge-gallery-title">
    <Button variant="secondary" onClick={onBack}>← Back to profile</Button>
    <h2 id="badge-gallery-title">Your badge collection</h2>
    <p>Every badge is a memory of getting out there.</p>
    <ProfileBadges games={games} roster={roster} userId={userId} gallery/>
  </section>;
}
