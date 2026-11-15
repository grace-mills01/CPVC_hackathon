import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import Button from './Button.jsx';
import {BadgeEmblem} from './ProfileBadges.jsx';
import {activityBadges} from '../lib/badges.js';
import {badgeUnlocks, readBadgeHistory} from '../lib/badgeUnlocks.js';
import './badge-unlock.css';

export function BadgeReveal({badge, remaining = 1, onContinue, onClose, onGallery}) {
  const dialog = useRef(null);
  const continueButton = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    continueButton.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} className={`badge-reveal achievement--${badge.tone}`} aria-labelledby="badge-reveal-title" aria-describedby="badge-reveal-description" onCancel={event => {event.preventDefault(); onClose();}}>
    <div className="badge-reveal-stage" key={badge.id}>
      <Button variant="icon" type="button" className="badge-reveal-close" aria-label="Close badge celebration" onClick={onClose}>×</Button>
      <div className="badge-reveal-confetti" aria-hidden="true">{Array.from({length:24}, (_,i) => {
        const angle = i * Math.PI * 2 / 24, distance = 110 + i % 4 * 35;
        return <span key={i} style={{'--x':`${Math.cos(angle)*distance}px`,'--y':`${Math.sin(angle)*distance+45}px`,'--turn':`${i*37}deg`,animationDelay:`${.3+i%5*.045}s`}}/>;
      })}</div>
      <p className="badge-reveal-eyebrow">NEW BADGE UNLOCKED</p>
      <div className="badge-reveal-art"><div className="badge-reveal-ring"/><div className="badge-reveal-ring badge-reveal-ring-outer"/><BadgeEmblem badge={badge}/></div>
      <div className="badge-reveal-copy"><span className="badge-reveal-detail">{badge.detail}</span><h2 id="badge-reveal-title">{badge.name}</h2><p id="badge-reveal-description">{badge.description}</p><p className="badge-reveal-saved">Added to your profile collection.</p></div>
      <div className="badge-reveal-actions"><Button variant="primary" type="button" ref={continueButton} onClick={remaining > 1 ? onContinue : onGallery}>{remaining > 1 ? 'Next badge →' : 'See gallery →'}</Button>{remaining > 1 && <><Button variant="secondary" type="button" onClick={onGallery}>See gallery →</Button><p>{remaining} new badges to celebrate</p></>}</div>
    </div>
  </dialog>, document.body);
}

export default function BadgeUnlockCelebration({games, roster, userId, active = false, onGallery}) {
  const seen = useRef(undefined);
  const [queue, setQueue] = useState([]);
  useEffect(() => {
    // Leave newly earned badges pending until the next profile visit.
    if (!active) return;
    const key = `togo:badge-reveals:v1:${userId}`;
    if (seen.current === undefined) {
      try {seen.current = readBadgeHistory(window.localStorage, key);} catch {seen.current = null;}
    }
    const {fresh, seen: next} = badgeUnlocks(activityBadges(games, roster, userId, new Date()).earned, seen.current);
    seen.current = next;
    try {window.localStorage.setItem(key, JSON.stringify(next));} catch { /* Session memory still prevents repeats when storage is unavailable. */ }
    if (fresh.length) setQueue(current => [...current, ...fresh]);
  }, [games, roster, userId, active]);
  if (!active || !queue.length) return null;
  return <BadgeReveal badge={queue[0]} remaining={queue.length} onContinue={() => setQueue(current => current.slice(1))} onClose={() => setQueue([])} onGallery={() => {setQueue([]); onGallery();}}/>;
}
